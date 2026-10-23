const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env = false, argv = false) => {
  const { mode = 'development' } = argv;

  const getStyleLoaders = () => {
    return [MiniCssExtractPlugin.loader, 'css-loader'];
  };

  const getPlugins = () => {
    const plugins = [];

    plugins.push(
      new MiniCssExtractPlugin({
        filename: 'main.css',
      }),
    );

    return plugins;
  };

  return {
    mode,

    entry: {
      index: {
        import: './src/index.ts',
      },
    },

    output: {
      filename: 'main.js',
      clean: true,
    },

    resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },

    module: {
      rules: [
        {
          test: /\.(js|ts)$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel-loader',
        },

        {
          test: /\.(css)$/,
          use: getStyleLoaders(),
        },

        {
          test: /\.(s[ca]ss)$/,
          use: [...getStyleLoaders(), 'sass-loader'],
        },
      ],
    },

    performance: { maxEntrypointSize: 512000, maxAssetSize: 512000 },

    plugins: getPlugins(),

    devServer: {
      hot: true,
      allowedHosts: 'all',
      webSocketServer: 'ws',
      devMiddleware: { writeToDisk: true },
    },
  };
};
