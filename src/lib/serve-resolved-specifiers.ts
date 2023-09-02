import { error as consoleError, log } from 'node:console';
import { readFile, stat } from 'node:fs/promises';
import { RequestListener, Server } from 'node:http';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { init, parse } from 'es-module-lexer';

import { cwd } from './util.js';

const files = new Map<string, string>();

process.on('SIGUSR2', () => {
  log('received SIGUSR2, deleting in-memory module cache');
  files.clear();
});

await init;

const isBareIdentifier = (identifier: string) => {
  if (identifier.startsWith('../')) return false;
  if (identifier.startsWith('./')) return false;
  if (identifier.startsWith('/')) return false;

  return true;
};

const resolveSpecifier = async (specifier: string, moduleUrl: URL) => {
  log(`\thandling specifier "${specifier}"`);

  try {
    const resolvedUrl = await import.meta.resolve?.(specifier, moduleUrl);
    if (!resolvedUrl) return undefined;

    const relativePath = relative(cwd, fileURLToPath(resolvedUrl));

    return `/${relativePath}`;
  } catch (error) {
    consoleError(
      new Error(`could not handle specifier "${specifier}"`, {
        cause: error,
      }),
    );

    return undefined;
  }
};

const modifyImport = async (
  src: string,
  moduleUrl: URL,
  specifierStart: number,
  specifierEnd: number,
) => {
  const specifier = src.slice(specifierStart, specifierEnd);

  if (!isBareIdentifier(specifier)) return null;
  if (specifier === 'import.meta') return null;

  const resolvedSpecifier = await resolveSpecifier(specifier, moduleUrl);
  if (!resolvedSpecifier) return undefined;

  return `${src.slice(0, specifierStart)}${resolvedSpecifier}${src.slice(
    specifierEnd,
  )}`;
};

const modifySrc = async (pathname: string) => {
  const modulePath = join(cwd, pathname);

  const cached = files.get(modulePath);
  if (cached) return cached;

  if (!modulePath.startsWith(cwd)) {
    throw new Error('module path is not allowed');
  }

  const stats = await stat(modulePath);
  if (!stats.isFile()) {
    throw new Error('module path does not exist');
  }

  const moduleUrl = pathToFileURL(modulePath);

  log(`handling module path "${modulePath}"`);

  const src = await readFile(modulePath, { encoding: 'utf8' });
  let modifiedSrc = src;

  const [imports] = parse(src);

  for (const { e: specifierEnd, s: specifierStart } of Array.from(
    imports,
  ).reverse()) {
    // eslint-disable-next-line no-await-in-loop
    let nextSrc = await modifyImport(
      modifiedSrc,
      moduleUrl,
      specifierStart,
      specifierEnd,
    );

    if (nextSrc === undefined) {
      // eslint-disable-next-line no-await-in-loop
      nextSrc = await modifyImport(
        modifiedSrc,
        moduleUrl,
        specifierStart + 1,
        specifierEnd - 1,
      );
    }

    if (!nextSrc) continue;

    modifiedSrc = nextSrc;
  }

  files.set(modulePath, modifiedSrc);

  return modifiedSrc;
};

const handleRequest: RequestListener = async (request, response) => {
  try {
    const {
      headers: { host },
      url: url_,
    } = request;

    if (!host) {
      throw new Error('no host header in request');
    }

    if (!url_) {
      throw new Error('no url in request');
    }

    const { pathname } = new URL(url_, `http://${host}`);

    const modifiedSrc = await modifySrc(pathname);

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/javascript');
    response.end(modifiedSrc);
  } catch (error) {
    consoleError(error);

    response.statusCode = 404;
    response.end(error.toString());
  }
};

export const serveResolvedSpecifiers = async (port: number): Promise<void> => {
  const server = new Server();
  server.on('request', handleRequest);

  server.listen(port, () => log(`listening on port ${port}\n`));
};
