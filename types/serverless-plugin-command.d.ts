export interface IServerlessPluginCommand {
  commands?: Record<string, IServerlessPluginCommand>;
  lifecycleEvents?: string[];
  options?: Record<
    string,
    {
      default?: any;
      required?: boolean;
      shortcut?: string;
      usage?: string;
    }
  >;
  usage?: string;
}
