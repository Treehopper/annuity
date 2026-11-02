// Single source of the web base path (README §4.11). In CI, actions/configure-pages reports
// it (GitHub Pages serves project sites at /<repository name>/) and the workflow passes it as
// BASE_PATH. Locally it defaults to /annuity/. Always returned with leading and trailing slash.
const DEFAULT = '/annuity/';

module.exports = function basePath(raw = process.env.BASE_PATH) {
  const trimmed = (raw && raw.trim() ? raw : DEFAULT).replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
};
