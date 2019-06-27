export interface IDynamoDBConfig {
  stage?: string[];
  start: IDynamoDBStartConfig;
}

interface IDynamoDBStartConfig extends IDynamoDBLaunchOptions {
  migrate?: boolean | null;
  // seed?: boolean | null;
  noStart?: boolean | null;
}

export interface IDynamoDBLaunchOptions {
  cors?: string | null;
  dbPath?: string | null;
  delayTransientStatuses?: boolean | null;
  inMemory?: boolean | null;
  optimizeDbBeforeStartup?: boolean | null;
  port?: number | string | null;
  sharedDb?: boolean | null;

  heapInitial?: string | null;
  heapMax?: string | null;
}
