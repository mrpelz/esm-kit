#!/usr/bin/env -S node --use_strict --enable-source-maps --experimental-modules --experimental-import-meta-resolve

import { error } from 'node:console';
import { argv, exit } from 'node:process';

import { generateImportMap, replaceInFile } from '../main.js';

const filePath = argv.at(-2);
const prefix = argv.at(-1);

if (!filePath || !filePath.endsWith('.html')) {
  error('supply file path to HTML-file as second-to-last argument');

  exit(1);
}

if (!prefix) {
  error('supply URL-prefix as last argument');

  exit(1);
}

await replaceInFile(
  filePath,
  `<script type="importmap">${JSON.stringify(
    await generateImportMap(prefix),
  )}</script>`,
  new RegExp('<script type="importmap">.*?<\\/script>', 'g'),
);
