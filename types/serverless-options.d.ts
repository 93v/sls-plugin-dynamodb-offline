import Serverless from "serverless";

export interface IServerlessOptions extends Serverless.Options {
  all?: string;
  stack?: string;
  skipAdditionalStacks?: boolean;
}
