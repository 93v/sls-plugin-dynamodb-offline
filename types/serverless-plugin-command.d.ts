export interface IServerlessPluginCommand {
  commands?: {
    [key: string]: IServerlessPluginCommand;
  };
  lifecycleEvents?: string[];
  options?: {
    [key: string]: {
      required?: boolean;
      shortcut?: string;
      usage?: string;
      default?: any;
    };
  };
  usage?: string;
}
