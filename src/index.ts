import { DynamoDB } from "aws-sdk/clients/all";
import { ChildProcess, spawn } from "child_process";
import { join } from "path";
import Serverless from "serverless";
import { oc } from "ts-optchain";
import { IStack, IStacksMap } from "../types/additional-stack";
import { IDynamoDBConfig, IDynamoDBLaunchOptions } from "../types/dynamodb";
import { IProvider } from "../types/provider";
import { IServerlessPluginCommand } from "../types/serverless-plugin-command";

const DB_LOCAL_PATH = join(__dirname, "../bin");

class ServerlessPlugin {
  public commands: {
    [command: string]: IServerlessPluginCommand;
  };
  public hooks: {
    [event: string]: () => Promise<any>;
  };
  public provider: IProvider;
  private additionalStacksMap: IStacksMap;
  private defaultStack: IStack;
  private dynamoDBConfig: IDynamoDBConfig;
  private dbInstances: { [port: string]: ChildProcess } = {};

  public constructor(private serverless: Serverless) {
    this.provider = this.serverless.getProvider("aws");

    this.commands = {};

    this.hooks = {
      "before:offline:start:end": this.stopDynamoDB,
      "before:offline:start:init": this.startDynamoDB,
    };

    this.dynamoDBConfig = oc(this.serverless).service.custom.dynamodb({});

    this.additionalStacksMap = oc(
      this.serverless,
    ).service.custom.additionalStacks({});

    this.defaultStack = ((oc(this.serverless.service) as unknown) as {
      resources: any;
    }).resources();
  }

  private spawnDynamoDBProcess = async (options: IDynamoDBLaunchOptions) => {
    // We are trying to construct something like this:
    // java -D"java.library.path=./DynamoDBLocal_lib" -jar DynamoDBLocal.jar

    const port = oc(options)
      .port(8000)
      .toString();

    const args = [];

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

    const proc = spawn("java", args, {
      cwd: DB_LOCAL_PATH,
      env: process.env,
      stdio: ["pipe", "pipe", process.stderr],
    });

    if (proc.pid == null) {
      throw new Error("Unable to start the DynamoDB Local process");
    }

    proc.on("error", (error) => {
      throw error;
    });

    this.dbInstances[port] = proc;

    return { proc, port };
  }

  private killDynamoDBProcess = async (options: IDynamoDBLaunchOptions) => {
    const port = oc(options)
      .port(8000)
      .toString();

    if (this.dbInstances[port] != null) {
      this.dbInstances[port].kill("SIGKILL");
      delete this.dbInstances[port];
    }
  }

  private startDynamoDB = async () => {
    if (this.dynamoDBConfig.start.noStart) {
      this.serverless.cli.log(
        "DynamoDB Offline - [noStart] options is true. Will not start.",
      );
      return;
    }

    const { port, proc } = await this.spawnDynamoDBProcess(
      this.dynamoDBConfig.start,
    );

    proc.on("close", (code) => {
      this.serverless.cli.log(
        `DynamoDB Offline - Failed to start with code ${code}`,
      );
    });

    this.serverless.cli.log(
      `DynamoDB Offline - Started, visit: http://localhost:${port}/shell`,
    );

    if (!this.dynamoDBConfig.start.migrate) {
      this.serverless.cli.log(
        "DynamoDB Offline - [migrate] options is not true. Will not create tables.",
      );
      return;
    }

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

    const dbClient = new DynamoDB({
      accessKeyId: "localAwsAccessKeyId",
      endpoint: `http://localhost:${port}`,
      region: "localhost",
      secretAccessKey: "localAwsSecretAccessKey",
    });

    await Promise.all(tables.map((table) => this.createTable(dbClient, table)));
  }

  private stopDynamoDB = async () => {
    await this.killDynamoDBProcess(this.dynamoDBConfig.start);
    this.serverless.cli.log("DynamoDB Offline - Stopped");
  }

  private createTable = async (dbClient: DynamoDB, table: any) => {
    const params: DynamoDB.CreateTableInput = table.Properties;

    // Removing locally unsupported params
    if (params.SSESpecification) {
      delete (params.SSESpecification as any).SSEEnabled;
    }
    delete (params as any).PointInTimeRecoverySpecification;
    delete (params as any).TimeToLiveSpecification;

    try {
      await dbClient.createTable(params).promise();
      this.serverless.cli.log(
        `DynamoDB Offline - Table [${params.TableName}] created`,
      );
    } catch (error) {
      if (error.code === "ResourceInUseException") {
        this.serverless.cli.log(
          `DynamoDB Offline - Table [${params.TableName}] already exists`,
        );
      } else {
        throw error;
      }
    }
  }
}

export = ServerlessPlugin;
