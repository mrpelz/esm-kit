import { error, log } from 'node:console';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cwd as cwd_ } from 'node:process';

export const cwd = cwd_();

export const nodeModulesDirectory = join(cwd, 'node_modules');

export const replaceInFile = async (
  filePath_: string,
  replaceValue: string,
  placeholder: RegExp,
): Promise<void> => {
  const filePath = resolve(filePath_);

  if (!filePath.startsWith(cwd)) {
    error(`"${filePath}" is outside working directory`);

    return;
  }

  log(`handling file "${filePath}"`);

  const template = await readFile(filePath);

  const result = template.toString().replaceAll(placeholder, replaceValue);

  writeFile(filePath, Buffer.from(result));
};
