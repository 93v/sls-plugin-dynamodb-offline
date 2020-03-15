import AwsProvider from "serverless/plugins/aws/provider/awsProvider";

export interface Provider extends AwsProvider {
  naming: any;
  request: any;
}
