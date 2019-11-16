export interface Stack {
  Conditions?: any | null;
  Deploy?: any | null;
  Description?: any | null;
  Mappings?: any | null;
  Metadata?: any | null;
  Outputs?: any | null;
  Parameters?: any | null;
  Resources?: any | null;
  StackName?: string | null;
  Tags?: any | null;
  Transform?: any | null;
}

export type IStacksMap = Record<string, Stack>;
