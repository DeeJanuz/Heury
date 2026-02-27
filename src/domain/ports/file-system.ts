export interface IFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(directory: string, pattern?: string): Promise<string[]>;
  getFileHash(path: string): Promise<string>;
  isDirectory(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}
