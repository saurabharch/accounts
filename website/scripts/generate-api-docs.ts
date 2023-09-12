import { readdirSync, readFileSync, writeFileSync, renameSync, copyFileSync } from 'fs';
import { resolve } from 'path';
import { Application } from 'typedoc';

const packagesDir = resolve(__dirname, '..', '..', 'packages');
const modulesDir = resolve(__dirname, '..', '..', 'modules');
const websiteDir = resolve(__dirname, '..', '..', 'website');
const apiDocsDir = resolve(__dirname, '..', '..', 'website', 'docs', 'api');
const sidebarPath = resolve(websiteDir, 'sidebars.js');
const sidebarTmpPath = resolve(websiteDir, 'sidebars.tmp.js');

/**
 * We need to save the sidebar content in a variable because typedoc-plugin-markdown overwrite
 * the file to generate the package sidebar. At the end of the script we restore the file.
 */
copyFileSync(sidebarPath, sidebarTmpPath);
writeFileSync(sidebarPath, `module.exports = {};`, { encoding: 'utf8' });

let packagesList = readdirSync(packagesDir);
let modulesList = readdirSync(modulesDir);

// Do not build the docs for these packages
const excludePackages = ['database-tests', 'e2e', 'error', 'types'];
const excludeModules = ['magic-link', 'password'];

const app = new Application();

// Config for typedoc;
app.bootstrap({
  theme: 'docusaurus2',
  mode: 'file',
  ignoreCompilerErrors: true,
  excludePrivate: true,
  excludeNotExported: true,
  tsconfig: 'tsconfig.json',
  plugin: ['typedoc-plugin-markdown'],
});

// Do not build the docs for these packages
packagesList = packagesList.filter((dir) => !excludePackages.includes(dir));
modulesList = modulesList.filter((dir) => !excludeModules.includes(dir));

[
  ...packagesList.map((dir) => [packagesDir, dir]),
  ...modulesList.map((dir) => [modulesDir, dir]),
].forEach(([path, dir]) => {
  // Generate the api doc for each package
  app.generateDocs(app.expandInputFiles([resolve(path, dir, 'src')]), resolve(apiDocsDir, dir));

  // We move the generated sidebar into the good API folder so they can be reused when the sidebar is generated
  renameSync(sidebarPath, resolve(apiDocsDir, dir, 'sidebars.js'));
});

// This is a fix for a generics issue, see https://github.com/tom-grey/typedoc-plugin-markdown/issues/119
for (const packageName of readdirSync(apiDocsDir)) {
  const filePath = resolve(apiDocsDir, packageName, 'globals.md');
  let fileContent = readFileSync(filePath, {
    encoding: 'utf8',
  });
  fileContent = fileContent.replace(/</g, '‹').replace(/>/g, '›');
  writeFileSync(filePath, fileContent, { encoding: 'utf8' });
}

// We restore the sidebar file.
renameSync(sidebarTmpPath, sidebarPath);
