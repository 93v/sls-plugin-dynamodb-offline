import AwsProvider from "serverless/plugins/aws/provider/awsProvider";

export interface IProvider extends AwsProvider {
  request?: any;
  naming?: any;
}
