import { exec } from 'node:child_process';
import { error } from 'node:console';
import { freemem } from 'node:os';
import { promisify } from 'node:util';

type Module = {
  dependencies: Record<string, Module>;
};

type ImortMap = {
  imports: Record<string, string>;
  scopes: Record<string, Record<string, string>>;
};

const PREFIX = 'modules';

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
  module: unknown,
  importMap: ImortMap,
  scope: string[] = [],
) => {
  if (!isModule(module)) return;

  const { dependencies } = module;

  const scopeKey = scope.length
    ? [PREFIX, scope.map(encodeURIComponent)].flat()
    : [PREFIX];

  const target = scope.length
    ? (importMap.scopes[`/${scopeKey.join('/')}`] = {})
    : importMap.imports;

  for (const dependency of Object.keys(dependencies)) {
    const path = [scopeKey, encodeURIComponent(dependency)].flat().join('/');

    target[dependency] = `/${path}`;
    target[`${dependency}/`] = `/${path}/`;
  }

  for (const [key, dependency] of Object.entries(dependencies)) {
    getDependencies(dependency, importMap, [scope, key].flat());
  }
};

export const generateImportMap = async (): Promise<string> => {
  const importMap: ImortMap = {
    imports: {},
    scopes: {},
  };

  const rootModule = await promisify(exec)(
    'npm --offline ls --all --json --long --omit=dev',
    { maxBuffer: freemem() / 10 },
  )
    .then(({ stdout }) => JSON.parse(stdout))
    .catch((reason) => {
      error(reason);
      return {};
    });

  getDependencies(rootModule, importMap);

  return JSON.stringify(importMap, undefined, 2);
};
