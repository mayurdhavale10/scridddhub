const path = require('path');
const { createRequire } = require('module');

const mobileApp = path.resolve(__dirname, '../mobile-app');
const apiClient = path.resolve(__dirname, '../packages/api-client');

// The toolchain (webpack, its plugins, babel-loader) lives in mobile-app/node_modules,
// not web-app/node_modules — resolve requires from there until this repo moves to npm
// workspaces with hoisted node_modules.
const requireFromMobileApp = createRequire(path.join(mobileApp, 'package.json'));
const HtmlWebpackPlugin = requireFromMobileApp('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: path.resolve(__dirname, 'index.web.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  resolve: {
    // react-native-web stands in for react-native on the web build — this is the
    // one line that makes "same components, different platform" actually work.
    alias: {
      'react-native$': 'react-native-web',
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    // index.web.js physically lives in web-app/, but every package (react-native,
    // @babel/runtime, etc.) is installed in mobile-app/node_modules — without this,
    // webpack only looks for node_modules by walking up from web-app/, which never
    // reaches mobile-app since they're siblings, not parent/child.
    modules: [path.join(mobileApp, 'node_modules'), 'node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        // Transform this repo's own source (web-app + mobile-app + the api-client package),
        // not third-party node_modules code — except react-native-web itself, which ships
        // untranspiled JSX and needs the same babel pipeline.
        include: [__dirname, mobileApp, apiClient, /node_modules\/react-native-web/],
        use: {
          loader: 'babel-loader',
          options: {
            configFile: path.resolve(mobileApp, 'babel.config.js'),
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html'),
    }),
  ],
  devServer: {
    port: 3000,
    open: true,
  },
};
