import { createWriteStream } from 'node:fs';
import {
  mkdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import {
  parse,
  stringify,
} from 'css';

import {
  assertDefined,
  assertTruthy,
} from './assertions.js';

/** @param {string} path */
const directoryExists = (path) =>
  stat(path).then(
    (stats) => stats.isDirectory(),
    (error) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  );

/** @param {string} path */
const fileExists = (path) =>
  stat(path).then(
    (stats) => stats.isFile(),
    (error) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  );

const currentDir = dirname(fileURLToPath(import.meta.url));

const fontsDir = resolve(currentDir, 'fonts');

const firstArg = process.argv[2];
const fallbackInputURL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap';
const inputURL =
  firstArg && firstArg.startsWith('https://fonts.googleapis.com/')
    ? firstArg
    : fallbackInputURL;

const headers = {
  Accept: 'application/font-woff2',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0',
};

const cssCode = await fetch(inputURL, { headers }).then((response) =>
  response.text()
);

const syntaxTree = parse(cssCode);

assertDefined(syntaxTree.stylesheet, 'No stylesheet found');
const { rules } = syntaxTree.stylesheet;

/** @type {string | undefined} */
let subset;
/** @type {Record<string, string>} */
const fonts = {};

rules.forEach((rule) => {
  // Comment
  if ('comment' in rule) {
    subset = rule.comment?.trim();
  }
  // @font-face
  if ('declarations' in rule) {
    const { declarations } = rule;
    assertDefined(declarations, 'No declarations in rule found');
    /** @type {Record<string, string>} */
    const properties = {};
    /** @type {import('css').Declaration | undefined} */
    let srcProperty;
    declarations.forEach((d) => {
      if ('property' in d && d.property && d.value) {
        properties[d.property] = d.value;
        if (d.property === 'src') {
          srcProperty = d;
        }
      }
    });
    assertTruthy(srcProperty, 'src property not found');
    assertTruthy(properties.src, 'src property is not usable');
    const urlMatches = properties.src.match(/url\((.+?)\) format\('woff2'\)/);
    assertTruthy(urlMatches && urlMatches[1]);
    const url = urlMatches[1];
    const fontFamilyRaw = properties['font-family'];
    assertTruthy(fontFamilyRaw, 'No font-family found');
    const fontFamily = fontFamilyRaw
      .replaceAll(/"|'/g, '')
      .replaceAll(/ /g, '');
    const versionMatches = url.match(/\/(v\d+)\//);
    const version = versionMatches && versionMatches[1];
    const fontWeight = properties['font-weight'];
    assertTruthy(fontWeight, 'No font-weight found');
    const fontStyle = properties['font-style'];
    assertTruthy(fontStyle, 'No font-style found');
    const filename =
      [fontFamily, version, subset, fontWeight, fontStyle].join('-') + '.woff2';
    fonts[url] = filename;
    const newUrl = `./${filename}`;
    srcProperty.value = `url(${newUrl}) format('woff2')`;
  }
});

const fontsDirExists = await directoryExists(fontsDir);
if (!fontsDirExists) {
  await mkdir(fontsDir);
}

const newCssCode = stringify(syntaxTree);
await writeFile(resolve(currentDir, './fonts/fonts.css'), newCssCode);

const fontPairs = Object.entries(fonts);

await Promise.all(
  fontPairs.map(async ([url, filename]) => {
    const fontPath = resolve(fontsDir, filename);
    const fontFileExists = await fileExists(fontPath);
    if (fontFileExists) return;
    console.log('Download', url);
    const response = await fetch(url, { headers });
    assertDefined(response.body, 'Response has no body');
    const fileStream = createWriteStream(fontPath, { flags: 'wx' });
    await finished(
      Readable.fromWeb(
        // @ts-ignore
        response.body
      ).pipe(fileStream)
    );
  })
);

console.log(`${fontPairs.length} fonts written to ${fontsDir}! 🦹🏼`);
