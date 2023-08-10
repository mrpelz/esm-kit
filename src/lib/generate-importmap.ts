import { exec } from 'node:child_process';
import { error as consoleError } from 'node:console';
import { freemem } from 'node:os';
import { promisify } from 'node:util';

type Module = {
  dependencies: Record<string, Module>;
};

type ImortMap = {
  imports: Record<string, string>;
  scopes: Record<string, Record<string, string>>;
};

const getRootModule = async () => {
  try {
    const { stdout } = await promisify(exec)(
      'npm --offline ls --all --json --long --omit=dev --package-lock-only',
      { maxBuffer: freemem() / 4 },
    );

    return JSON.parse(stdout);
  } catch (error) {
    consoleError(error);

    return undefined;
  }
};

const isModule = (
  input: unknown,
): input is Module & { dependencies: Record<string, unknown> } => {
  if (!input) return false;
  if (typeof input !== 'object') return false;
  if (!('dependencies' in input)) return false;

  const { dependencies } = input;
  if (typeof dependencies !== 'object') return false;

  return true;
};

const getDependencies = (
  prefix: string,
  module: unknown,
  importMap: ImortMap,
  scope: string[] = [],
) => {
  if (!isModule(module)) return;

  const { dependencies } = module;

  const scopeKey =
    scope.length > 0 ? scope.map((part) => encodeURIComponent(part)) : [];

  const target =
    scope.length > 0
      ? (importMap.scopes[`${prefix}${scopeKey.join('+')}`] = {})
      : importMap.imports;

  for (const dependency of Object.keys(dependencies)) {
    const path = [scopeKey, encodeURIComponent(dependency)].flat().join('+');

    target[`${dependency}`] = `${prefix}${path}`;
    target[`${dependency}/`] = `${prefix}${path}/`;
  }

  for (const [key, dependency] of Object.entries(dependencies)) {
    getDependencies(prefix, dependency, importMap, [scope, key].flat());
  }
};

export const generateImportMap = async (prefix: string): Promise<ImortMap> => {
  const importMap: ImortMap = {
    imports: {},
    scopes: {},
  };

  const rootModule = await getRootModule();

  getDependencies(prefix, rootModule, importMap);

  return importMap;
};
