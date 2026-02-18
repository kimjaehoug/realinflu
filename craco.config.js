const fs = require('fs');
const path = require('path');

const reactRefreshRuntimePath = fs.realpathSync(require.resolve('react-refresh/runtime'));
const reactRefreshDir = path.dirname(reactRefreshRuntimePath);

module.exports = {
  webpack: {
    configure: (config) => {
      // 한글 등이 포함된 프로젝트 경로에서 react-refresh가 src 밖으로 인식되는
      // CRA v5 이슈 대응: alias + ModuleScopePlugin 허용 경로 확장
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-refresh': path.resolve(__dirname, 'src', 'react-refresh'),
      };

      if (Array.isArray(config.resolve?.plugins)) {
        config.resolve.plugins.forEach((plugin) => {
          if (plugin?.constructor?.name === 'ModuleScopePlugin') {
            if (plugin.allowedFiles?.add) {
              plugin.allowedFiles.add(reactRefreshRuntimePath);
            }
            if (Array.isArray(plugin.allowedPaths) && !plugin.allowedPaths.includes(reactRefreshDir)) {
              plugin.allowedPaths.push(reactRefreshDir);
            }
          }
        });
      }

      return config;
    },
  },
};
