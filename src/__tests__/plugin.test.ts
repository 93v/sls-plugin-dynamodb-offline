import ServerlessPlugin from "../index";

const serverless: any = {
  getProvider: () => ({}),
};

describe("Serverless Plugin DynamoDB Offline", () => {
  test("Should meet Serverless Plugin Interface", () => {
    const plugin = new ServerlessPlugin(serverless);
    expect(plugin.hooks).toEqual({
      "before:offline:start:end": expect.any(Function),
      "before:offline:start:init": expect.any(Function),
    });
  });
});
