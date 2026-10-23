module.exports = (env = false, argv = false) => {
  const { mode = 'development' } = argv;

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
          use: ['style-loader', 'css-loader'],
        },

        {
          test: /\.(s[ca]ss)$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
      ],
    },

    performance: { maxEntrypointSize: 512000, maxAssetSize: 512000 },

    devServer: {
      hot: true,
      allowedHosts: 'all',
      webSocketServer: 'ws',
      devMiddleware: { writeToDisk: true },
    },
  };
};
