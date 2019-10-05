import AwsProvider from "serverless/plugins/aws/provider/awsProvider";

export interface IProvider extends AwsProvider {
  naming: any;
  request?: any;
}
