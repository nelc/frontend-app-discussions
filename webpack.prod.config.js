const fs = require('fs');
const dotenv = require('dotenv');
const { createConfig } = require('@edx/frontend-build');

const config = createConfig('webpack-prod');

// The configuration is generated using the createConfig method from the frontend-build library,
// this method preloads multiple files to generate the resulting configuration, including webpack.common.config.js,
// https://github.com/nelc/frontend-build/blob/open-release/palm.nelp/config/webpack.common.config.js,
// which includes ParagonWebpackPlugin. This plugin, in turn, retrieves its configuration from the .env.development file
// https://github.com/nelc/frontend-build/blob/open-release/palm.nelp/lib/plugins/paragon-webpack-plugin/ParagonWebpackPlugin.js#L20-L22
// Therefore, regardless of the configuration type, the plugin always utilizes data from .env.development.
// The following code overrides this behavior in order to use the .env file.
const envConfig = dotenv.parse(fs.readFileSync('.env'));
Object.keys(envConfig).forEach(k => {
  process.env[k] = envConfig[k];
});

module.exports = config;
