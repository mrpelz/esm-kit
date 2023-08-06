#!/usr/bin/env -S node --use_strict --enable-source-maps --experimental-modules --experimental-import-meta-resolve

import { error } from 'node:console';
import { argv, exit } from 'node:process';

import { serveRedirects } from '../main.js';

const lastArg = argv.at(-1);
const port = lastArg ? Number.parseInt(lastArg, 10) : undefined;

if (!port || Number.isNaN(port) || !Number.isInteger(port)) {
  error('supply port as argument');

  exit(1);
}

serveRedirects(port);
