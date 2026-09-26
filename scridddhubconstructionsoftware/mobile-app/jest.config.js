module.exports = {
  preset: '@react-native/jest-preset',
  // @scridddhub/api-client lives in ../packages/api-client (a sibling, reached through the
  // node_modules symlink); its own imports (openapi-fetch, @babel/runtime) need to resolve
  // against mobile-app/node_modules the same way web-app/webpack.config.js already does.
  modulePaths: ['<rootDir>/node_modules'],
};
