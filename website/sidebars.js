// @ts-check
const { readdirSync, existsSync } = require('fs');
const { resolve } = require('path');

const packagesDir = resolve(__dirname, '..', 'packages');
const modulesDir = resolve(__dirname, '..', 'modules');
const apiDocsDir = resolve(__dirname, '..', 'website', 'docs', 'api');

const dirs = readdirSync(apiDocsDir);

/** @type any */
const generatedApi = {};

function resolvePackage(dir) {
  let path = resolve(packagesDir, dir, 'package.json');
  return existsSync(path) ? path : resolve(modulesDir, dir, 'package.json');
}

dirs.forEach((dir) => {
  const packageName = require(resolvePackage(dir)).name;
  const generatedSidebar = require(resolve(apiDocsDir, dir, 'sidebars'));
  generatedApi[packageName] = [];
  if (Object.keys(generatedSidebar.docs).length > 0) {
    generatedApi[packageName] = Object.keys(generatedSidebar.docs).map((key) => ({
      type: 'category',
      label: key,
      items: generatedSidebar.docs[key],
    }));
  }
  generatedApi[packageName].unshift(`api/${dir}/globals`);
  generatedApi[packageName].unshift(`api/${dir}/index`);
});

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: {
    Introduction: ['introduction', 'contributing'],
    'Getting started': ['getting-started', 'server', 'handling-errors', 'email', 'client'],
    Transports: [
      'transports/graphql',
      {
        type: 'category',
        label: 'Rest',
        items: ['transports/rest-express', 'transports/rest-client'],
      },
    ],
    Databases: ['databases/overview', 'databases/mongo', 'databases/redis', 'databases/typeorm'],
    Strategies: [
      {
        type: 'category',
        label: 'Password',
        items: ['strategies/password', 'strategies/password-client'],
      },
      'strategies/facebook',
      'strategies/oauth',
      'strategies/twitter',
    ],
    Cookbook: ['cookbook/react-native'],
  },
  api: generatedApi,
};

module.exports = sidebars;
