import { exec } from 'node:child_process';
import { error as consoleError, log } from 'node:console';
import { RequestListener, Server } from 'node:http';
import { join, relative, resolve } from 'node:path';
import { cwd as cwd_ } from 'node:process';
import { promisify } from 'node:util';

import { PREFIX } from './util.js';

const cwd = cwd_();

const nodeModulesDirectory = join(cwd, 'node_modules');

const getRootEntry = async () => {
  try {
    const { stdout } = await promisify(exec)('npm --offline pkg get module');

    const pkgModule = JSON.parse(stdout);
    if (typeof pkgModule !== 'string' || pkgModule.length === 0) {
      return undefined;
    }

    return new URL(resolve(cwd, pkgModule), 'file:');
  } catch {
    return undefined;
  }
};

const handleRequest =
  (rootEntry: URL): RequestListener =>
  async (request, response) => {
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

      const pathElements = pathname
        .slice(1)
        .split('+')
        .map((pathElement) => decodeURIComponent(pathElement));

      log(`resolving pathElements: ${JSON.stringify(pathElements)}`);

      let moduleUrl = rootEntry;

      for (const pathElement of pathElements) {
        log(`resolving "${pathElement}"\n\tsource: "${moduleUrl}"`);

        try {
          // eslint-disable-next-line no-await-in-loop
          const resolvedPath = await import.meta.resolve?.(
            pathElement,
            moduleUrl,
          );
          if (!resolvedPath) break;

          const nextModuleUrl = new URL(resolvedPath, 'file:');
          log(`\ttarget: "${nextModuleUrl}"`);

          if (!nextModuleUrl) break;

          moduleUrl = nextModuleUrl;
        } catch (error) {
          throw new Error(`cannot resolve module "${pathElement}"`, {
            cause: error,
          });
        }
      }

      log('');

      const { pathname: modulePath } = moduleUrl;

      if (!modulePath.startsWith(nodeModulesDirectory)) {
        throw new Error('resolved path is not allowed');
      }

      response.statusCode = 308;
      response.setHeader(
        'Location',
        `${PREFIX}${relative(nodeModulesDirectory, modulePath)}`,
      );
      response.end();
    } catch (error) {
      consoleError(error);

      response.statusCode = 500;
      response.end(error.toString());
    }
  };

export const serveRedirects = async (port: number): Promise<void> => {
  const rootEntry = await getRootEntry();
  if (!rootEntry) {
    consoleError('no root entry found');
    return;
  }

  log(`rootEntry: "${rootEntry.pathname}"`);

  const server = new Server();
  server.on('request', handleRequest(rootEntry));

  server.listen(port, () => log(`listening on port ${port}\n`));
};
