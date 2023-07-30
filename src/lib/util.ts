import { readFile, writeFile } from 'node:fs/promises';

export const PREFIX = '/modules/';

export const replaceInFile = async (
  filePath: string,
  replaceValue: string,
  placeholder: RegExp,
): Promise<void> => {
  const template = await readFile(filePath);

  const result = template.toString().replace(placeholder, replaceValue);

  writeFile(filePath, Buffer.from(result));
};
