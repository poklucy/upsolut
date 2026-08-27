const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');

const webpackDir = __dirname;
const webDir = path.resolve(webpackDir, '..');
const distPath = path.resolve(webDir, 'dist');
const assetsPath = path.resolve(webDir, 'assets');

module.exports = async () => {
  // Используем postcss-nested вместо postcss-nesting
  const postcssNested = (await import('postcss-nested')).default;

  return {
    entry: {
      styles: path.resolve(assetsPath, 'styles/index.css'),
      footer: path.resolve(webpackDir, 'footer.entry.js'),
    },

    output: {
      path: distPath,
      filename: (pathData) =>
        pathData.chunk.name === 'styles'
          ? 'styles.[contenthash:8].js'
          : 'footer.[contenthash:8].js',
      clean: true,
    },

    resolve: {
      fullySpecified: false,
    },

    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                url: false,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    postcssNested(),
                    require('postcss-url')({
                      url: (asset) => {
                        if (asset.url.includes('../../fonts/')) {
                          return asset.url.replace('../../fonts/', 'fonts/');
                        }
                        if (asset.url.includes('../fonts/')) {
                          return asset.url.replace('../fonts/', 'fonts/');
                        }
                        if (asset.url.includes('/fonts/')) {
                          return asset.url.replace(/.*\/fonts\//, 'fonts/');
                        }
                        return asset.url;
                      },
                    }),
                  ],
                },
              },
            },
          ],
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name][ext]',
          },
        },
      ],
    },

    plugins: [
      new MiniCssExtractPlugin({
        filename: 'main.[contenthash:8].min.css',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(assetsPath, 'fonts'),
            to: path.resolve(distPath, 'fonts'),
            noErrorOnMissing: true,
          },
        ],
      }),
      {
        apply: (compiler) => {
          compiler.hooks.afterEmit.tap('SaveManifest', (compilation) => {
            const names = Object.keys(compilation.assets);
            const cssFiles = names.filter(
              (asset) => asset.endsWith('.css') && asset.startsWith('main.')
            );
            const jsFiles = names.filter(
              (asset) => asset.startsWith('footer.') && asset.endsWith('.js')
            );

            if (cssFiles.length === 0) {
              console.warn('SaveManifest: нет CSS (main.*.min.css)');
              return;
            }

            const manifest = {
              css: cssFiles[0],
              js: jsFiles[0] ?? '',
              timestamp: Date.now(),
            };

            const manifestPath = path.resolve(distPath, 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            console.log(`✅ manifest.json: css=${manifest.css} js=${manifest.js || '—'}`);
          });
        },
      },
    ],

    optimization: {
      minimize: true,
      minimizer: [new CssMinimizerPlugin(), new TerserPlugin()],
    },

    performance: {
      hints: false,
    },

    mode: 'production',
  };
};
