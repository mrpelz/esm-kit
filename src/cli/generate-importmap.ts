#!/usr/bin/env -S node --use_strict --enable-source-maps --experimental-modules --experimental-import-meta-resolve

import { argv, exit, stderr } from 'node:process';

import { generateImportMap, replaceInFile } from '../main.js';

const filePath = argv.at(-1);

if (!filePath) {
  stderr.write('supply file path as argument');

  exit(1);
}

await replaceInFile(
  filePath,
  `<script type="importmap">${JSON.stringify(
    await generateImportMap(),
  )}</script>`,
  new RegExp('<script type="importmap">.*?<\\/script>'),
);
