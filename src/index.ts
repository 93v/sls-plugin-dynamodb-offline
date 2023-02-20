import { ChildProcess, spawn } from "child_process";
import net from "net";
import { join } from "path";
import Serverless from "serverless";
import { setTimeout } from "timers/promises";

import {
  CreateTableCommand,
  CreateTableCommandInput,
  DescribeTableCommand,
  DynamoDBClient,
  DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import {
  DescribeStreamCommand,
  DynamoDBStreamsClient,
  DynamoDBStreamsClientConfig,
  GetRecordsCommand,
  GetRecordsInput,
  GetShardIteratorCommand,
  GetShardIteratorInput,
} from "@aws-sdk/client-dynamodb-streams";
import {
  InvokeCommand,
  LambdaClient,
  LambdaClientConfig,
} from "@aws-sdk/client-lambda";

import { IStacksMap, Stack } from "../types/additional-stack";
import {
  DynamoDBConfig,
  DynamoDBLaunchOptions,
  Stream,
} from "../types/dynamodb";
import { Provider } from "../types/provider";
import { ServerlessPluginCommand } from "../types/serverless-plugin-command";

const DB_LOCAL_PATH = join(__dirname, "../bin");

const DEFAULT_READ_INTERVAL = 500;

const isPortAvailablePromise = (port: string) =>
  new Promise<boolean>((resolve) => {
    const tester = net
      .createServer()
      .once("error", (err: any) => {
        if (err.code !== "EADDRINUSE") {
          return;
        }
        resolve(false);
      })
      .once("listening", () => {
        tester
          .once("close", () => {
            resolve(true);
          })
          .close();
      })
      .listen(port);
  });

class ServerlessDynamoDBOfflinePlugin {
  public readonly commands: Record<string, ServerlessPluginCommand>;
  public readonly hooks: Record<string, () => Promise<any>>;
  public provider: Provider;
  private additionalStacksMap: IStacksMap;
  private defaultStack: Stack;
  private dynamoDBConfig: DynamoDBConfig;
  private dbClient?: DynamoDBClient;
  private dbStreamsClient?: DynamoDBStreamsClient;
  private dbInstances: Record<string, ChildProcess> = {};
  private readonly log: (message: string) => void;

  public constructor(
    private serverless: Serverless,
    _options: any,
    { log }: { log: (message: string) => void },
  ) {
    this.provider = this.serverless.getProvider("aws");
    this.log = log;

    this.commands = {};

    this.dynamoDBConfig = this.serverless.service?.custom?.dynamodb || {};

    this.additionalStacksMap =
      this.serverless.service?.custom?.additionalStacks || {};

    this.defaultStack = (
      (this.serverless.service || {}) as unknown as {
        resources: any;
      }
    ).resources;

    this.hooks = {
      "before:offline:start:end": this.stopDynamoDB,
      "before:offline:start:init": this.startDynamoDB,
    };
  }

  private spawnDynamoDBProcess = async (options: DynamoDBLaunchOptions) => {
    // We are trying to construct something like this:
    // java -D"java.library.path=./DynamoDBLocal_lib" -jar DynamoDBLocal.jar

    const port = (options.port || 8000).toString();

    const args: string[] = [];

    if (options.heapInitial != null) {
      args.push(`-Xms${options.heapInitial}`);
    }

    if (options.heapMax != null) {
      args.push(`-Xmx${options.heapMax}`);
    }

    args.push(
      `-D"java.library.path=${DB_LOCAL_PATH}/DynamoDBLocal_lib"`,
      "-jar",
      "DynamoDBLocal.jar",
    );

    if (options.cors != null) {
      args.push("-cors", options.cors);
    }

    if (options.dbPath != null) {
      args.push("-dbPath", options.dbPath);
    } else {
      args.push("-inMemory");
    }

    if (options.delayTransientStatuses) {
      args.push("-delayTransientStatuses");
    }

    if (options.optimizeDbBeforeStartup) {
      args.push("-optimizeDbBeforeStartup");
    }

    if (port != null) {
      args.push("-port", port.toString());
    }

    if (options.sharedDb) {
      args.push("-sharedDb");
    }

    return new Promise<{ proc: ChildProcess; port: string }>(
      (resolve, reject) => {
        const proc = spawn("java", args, {
          cwd: DB_LOCAL_PATH,
          env: process.env,
          stdio: ["pipe", "pipe", process.stderr],
        });

        if (proc.pid == null) {
          throw new Error("Unable to start the DynamoDB Local process");
        }

        proc.on("error", (error) => {
          reject(error);
        });

        proc.stdout.on("data", async (data) => {
          this.log(data.toString());

          if (
            data
              .toString()
              .includes(
                "Initializing DynamoDB Local with the following configuration",
              )
          ) {
            let isPortAvailable = await isPortAvailablePromise(port);

            while (isPortAvailable) {
              await setTimeout(100);
              isPortAvailable = await isPortAvailablePromise(port);
            }
            resolve({ proc, port });
          }
        });

        this.dbInstances[port] = proc;

        (
          [
            "beforeExit",
            "exit",
            "SIGINT",
            "SIGTERM",
            "SIGUSR1",
            "SIGUSR2",
            "uncaughtException",
          ] as unknown as NodeJS.Signals[]
        ).forEach((eventType) => {
          process.on(eventType, () => {
            this.killDynamoDBProcess(this.dynamoDBConfig.start);
          });
        });
      },
    );
  };

  private killDynamoDBProcess = (options: DynamoDBLaunchOptions) => {
    const port = (options.port || 8000).toString();

    if (this.dbInstances[port] != null) {
      this.dbInstances[port].kill("SIGKILL");
      delete this.dbInstances[port];
    }
  };

  private createDBStreamReadable = async (
    functionName: string,
    stream: Stream,
  ) => {
    this.log(`Create stream for ${functionName} on ${stream.tableName}`);

    const tableDescription = await this.dbClient?.send(
      new DescribeTableCommand({ TableName: stream.tableName }),
    );

    const streamArn = tableDescription?.Table?.LatestStreamArn;

    if (streamArn == null) {
      return;
    }

    const streamDescription = await this.dbStreamsClient?.send(
      new DescribeStreamCommand({ StreamArn: streamArn }),
    );

    if (streamDescription?.StreamDescription?.Shards == null) {
      return;
    }

    // Do not await to not block the rest of the serverless offline execution
    Promise.allSettled(
      streamDescription.StreamDescription.Shards.map(async (shard) => {
        if (shard.ShardId == null) {
          return;
        }

        if (this.dbStreamsClient == null) {
          return;
        }

        const shardIteratorType = stream.startingPosition || "TRIM_HORIZON";

        const getIteratorParams: GetShardIteratorInput = {
          ShardId: shard.ShardId,
          StreamArn: streamArn,
          ShardIteratorType: shardIteratorType,
        };

        if (this.dynamoDBConfig.stream?.iterator) {
          getIteratorParams.ShardIteratorType =
            this.dynamoDBConfig.stream?.iterator;
        } else if (this.dynamoDBConfig.stream?.startAt) {
          getIteratorParams.ShardIteratorType = "AT_SEQUENCE_NUMBER";
          getIteratorParams.SequenceNumber =
            this.dynamoDBConfig.stream?.startAt;
        } else if (this.dynamoDBConfig.stream?.startAfter) {
          getIteratorParams.ShardIteratorType = "AFTER_SEQUENCE_NUMBER";
          getIteratorParams.SequenceNumber =
            this.dynamoDBConfig.stream?.startAfter;
        } else {
          getIteratorParams.ShardIteratorType = "LATEST";
        }

        const iterator = await this.dbStreamsClient.send(
          new GetShardIteratorCommand(getIteratorParams),
        );

        if (iterator.ShardIterator == null) {
          return;
        }

        let shardIterator = iterator.ShardIterator;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const getRecordsParams: GetRecordsInput = {
            ShardIterator: shardIterator,
            Limit: stream.batchSize || 20,
          };

          const records = await this.dbStreamsClient.send(
            new GetRecordsCommand(getRecordsParams),
          );

          if (records.NextShardIterator != null) {
            shardIterator = records.NextShardIterator;
          }

          if (records.Records != null && records.Records.length) {
            const lambdaParams: LambdaClientConfig = {
              endpoint: `http://127.0.0.1:${
                this.serverless.service.custom["serverless-offline"]
                  .lambdaPort || 3002
              }`,
              region: this.dynamoDBConfig.start.region || "local",
            };

            const lambda = new LambdaClient(lambdaParams);

            const params = {
              FunctionName: `${this.serverless.service["service"]}-${this.serverless.service.provider.stage}-${functionName}`,
              InvocationType: "Event",
              Payload: new Uint8Array(Buffer.from(JSON.stringify(records))),
            };

            await lambda.send(new InvokeCommand(params));
          }

          await setTimeout(
            this.dynamoDBConfig.stream?.readInterval || DEFAULT_READ_INTERVAL,
          );
        }
      }),
    ).then((r) => {
      this.log(r.length.toString());
    });
  };

  private startDynamoDB = async () => {
    if (this.dynamoDBConfig.start.noStart) {
      this.log("DynamoDB Offline - [noStart] options is true. Will not start.");
    } else {
      const { port, proc } = await this.spawnDynamoDBProcess(
        this.dynamoDBConfig.start,
      );

      proc.on("close", (code) => {
        if (code === 0) {
          this.log("DynamoDB Offline - Stopped");
          return;
        }
        this.log(`DynamoDB Offline - Failed to start with code ${code}`);
      });

      this.log(
        `DynamoDB Offline - Started, visit: http://127.0.0.1:${port}/shell`,
      );
    }

    if (!this.dynamoDBConfig.start.migrate) {
      this.log(
        "DynamoDB Offline - [migrate] options is not true. Will not create tables.",
      );
      return;
    }

    const clientConfig: DynamoDBClientConfig | DynamoDBStreamsClientConfig = {
      endpoint: `http://${this.dynamoDBConfig.start.host || "127.0.0.1"}:${
        this.dynamoDBConfig.start.port
      }`,
      region: this.dynamoDBConfig.start.region || "local",
      credentials: {
        accessKeyId:
          this.dynamoDBConfig.start.accessKeyId || "localAwsAccessKeyId",
        secretAccessKey:
          this.dynamoDBConfig.start.secretAccessKey ||
          "localAwsSecretAccessKey",
      },
    };

    this.log(JSON.stringify(clientConfig, null, 2));

    this.dbClient = new DynamoDBClient(clientConfig);

    this.dbStreamsClient = new DynamoDBStreamsClient(clientConfig);

    const tables: any[] = [];
    Object.values({
      ...this.additionalStacksMap,
      ...{ [Symbol(Date.now()).toString()]: this.defaultStack },
    }).forEach((stack) => {
      if (stack == null) {
        return;
      }
      Object.values(stack.Resources).forEach((resource: any) => {
        if (resource.Type === "AWS::DynamoDB::Table") {
          tables.push(resource);
        }
      });
    });

    if (tables.length === 0) {
      return;
    }

    await Promise.all(
      tables.map(async (table) => {
        if (this.dbClient == null) {
          return;
        }
        return this.createTable(this.dbClient, table);
      }),
    );

    await Promise.all(
      this.serverless.service.getAllFunctions().map(async (functionName) => {
        const events = this.serverless.service.getFunction(functionName).events;

        await Promise.all(
          events.map(async (event) => {
            const stream = event["stream"] as Stream | undefined;

            if (
              stream == null ||
              !stream.enabled ||
              stream.type !== "dynamodb"
            ) {
              return;
            }

            return this.createDBStreamReadable(functionName, stream);
          }),
        );
      }),
    );
  };

  private stopDynamoDB = async () => {
    this.killDynamoDBProcess(this.dynamoDBConfig.start);
    this.log("DynamoDB Offline - Stopped");
  };

  private createTable = async (dbClient: DynamoDBClient, table: any) => {
    const params: CreateTableCommandInput = table.Properties;

    // Removing locally unsupported params
    if (params.SSESpecification) {
      delete (params.SSESpecification as any).SSEEnabled;
    }
    delete (params as any).PointInTimeRecoverySpecification;
    delete (params as any).TimeToLiveSpecification;

    if (
      params.StreamSpecification &&
      params.StreamSpecification.StreamViewType
    ) {
      params.StreamSpecification.StreamEnabled = true;
    }

    try {
      await dbClient.send(new CreateTableCommand(params));
      this.log(`DynamoDB Offline - Table [${params.TableName}] created`);
    } catch (error) {
      if ((error as Error).name === "ResourceInUseException") {
        this.log(
          `DynamoDB Offline - Table [${params.TableName}] already exists`,
        );
      } else {
        throw error;
      }
    }
  };
}

export = ServerlessDynamoDBOfflinePlugin;
