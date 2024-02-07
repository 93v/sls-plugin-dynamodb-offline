import { ShardIteratorType } from "@aws-sdk/client-dynamodb-streams";

export interface DynamoDBConfig {
  stage?: string[];
  start: DynamoDBStartConfig;
  stream?: DynamoDBStreamConfig;
}

interface DynamoDBStartConfig extends DynamoDBLaunchOptions {
  migrate?: boolean | null;
  // seed?: boolean | null;
  noStart?: boolean | null;
}

interface DynamoDBStreamConfig {
  readInterval?: number | null;
  iterator?: ShardIteratorType | null;
  startAt?: string | null;
  startAfter?: string | null;
}

export interface DynamoDBLaunchOptions {
  cors?: string | null;
  dbPath?: string | null;
  delayTransientStatuses?: boolean | null;
  inMemory?: boolean | null;
  optimizeDbBeforeStartup?: boolean | null;
  port?: number | string | null;
  host?: string | null;
  sharedDb?: boolean | null;

  heapInitial?: string | null;
  heapMax?: string | null;

  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  region?: string | null;
}

export interface Stream {
  enabled: boolean;
  type: string;
  arn: Record<string, string>;
  tableName: string;
  batchSize: number;
  startingPosition: ShardIteratorType;
}
