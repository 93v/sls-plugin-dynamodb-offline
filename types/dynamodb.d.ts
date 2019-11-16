export interface DynamoDBConfig {
  stage?: string[];
  start: DynamoDBStartConfig;
}

interface DynamoDBStartConfig extends DynamoDBLaunchOptions {
  migrate?: boolean | null;
  // seed?: boolean | null;
  noStart?: boolean | null;
}

export interface DynamoDBLaunchOptions {
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
