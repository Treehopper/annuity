// Dynamic part of the Expo config: the web base path comes from BASE_PATH (scripts/base-path.cjs).
const basePath = require('./scripts/base-path.cjs');

module.exports = ({ config }) => {
  const base = basePath();
  return {
    ...config,
    experiments: { ...config.experiments, ...(base === '/' ? {} : { baseUrl: base.replace(/\/$/, '') }) },
  };
};
