import { exec } from 'node:child_process';
import { error as consoleError, log } from 'node:console';
import { RequestListener, Server } from 'node:http';
import { join, relative, resolve } from 'node:path';
import { cwd as cwd_ } from 'node:process';
import { promisify } from 'node:util';

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

const resolvePath = async (moduleIdentifier: string, parentModule: URL) => {
  log(`resolving "${moduleIdentifier}"\n\tsource: "${parentModule}"`);

  try {
    const modulePath = await import.meta.resolve?.(
      moduleIdentifier,
      parentModule,
    );
    if (!modulePath) return undefined;

    const module = new URL(modulePath, 'file:');
    log(`\ttarget: "${module}"`);

    return module;
  } catch (error) {
    consoleError(
      new Error(`cannot resolve module "${moduleIdentifier}"`, {
        cause: error,
      }),
    );

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

      const paths = pathname
        .slice(1)
        .split('+')
        .map((pathElement) => decodeURIComponent(pathElement));

      log(`resolving pathElements: ${JSON.stringify(paths)}`);

      let module = rootEntry;

      for (const path of paths) {
        // eslint-disable-next-line no-await-in-loop
        let pathModule = await resolvePath(path, module);

        if (!pathModule) {
          throw new Error('resolved path not found');
        }

        module = pathModule;
      }

      log('');

      const { pathname: modulePath } = module;

      if (!modulePath.startsWith(nodeModulesDirectory)) {
        throw new Error('resolved path is not allowed');
      }

      const relativeModulePath = relative(nodeModulesDirectory, modulePath);

      response.statusCode = 307;
      response.setHeader('Location', `/${relativeModulePath}`);

      response.end();
    } catch (error) {
      consoleError(error);

      response.statusCode = 404;
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
