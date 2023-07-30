#!/usr/bin/env -S node --use_strict --enable-source-maps --experimental-modules --experimental-import-meta-resolve

import { argv, exit, stderr } from 'node:process';

import { serveRedirects } from '../main.js';

const port = argv.at(-1);

if (!port) {
  stderr.write('supply port as argument');

  exit(1);
}

serveRedirects(Number.parseInt(port, 10));
