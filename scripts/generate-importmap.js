#!/usr/bin/env -S node --use_strict --enable-source-maps --experimental-modules --experimental-import-meta-resolve

import { generateImportMap } from '../dist/main.js';

// eslint-disable-next-line no-console
console.log(await generateImportMap());
