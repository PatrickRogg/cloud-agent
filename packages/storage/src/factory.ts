import { JsonFileStorage } from './implementations/json-file';

export const createJsonFileStorage = (filePath: string) => {
  return new JsonFileStorage({ filePath });
};
