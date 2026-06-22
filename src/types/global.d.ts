declare global {
  interface Window {
    electronAPI: {
      readData: (filename: string, defaultData?: any) => Promise<any>;
      writeData: (filename: string, data: any) => Promise<boolean>;
      openFile: (filters?: any[]) => Promise<string[]>;
      saveFile: (defaultPath?: string, filters?: any[]) => Promise<string>;
    };
  }
}

export {};
