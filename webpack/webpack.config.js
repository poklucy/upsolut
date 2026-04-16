const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
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
    entry: path.resolve(assetsPath, 'styles/index.css'),

    output: {
      path: distPath,
      filename: 'temp.js',
      clean: true,
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
                    postcssNested(),  // 👈 ЗАМЕНИЛИ на postcss-nested
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
                      }
                    })
                  ]
                }
              }
            }
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
            const cssFiles = Object.keys(compilation.assets).filter(
                (asset) => asset.endsWith('.css') && asset.startsWith('main.')
            );

            if (cssFiles.length > 0) {
              const manifest = {
                css: cssFiles[0],
                timestamp: Date.now()
              };

              const manifestPath = path.resolve(distPath, 'manifest.json');
              fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
              console.log(`✅ Manifest saved: ${manifest.css}`);
            }
          });
        }
      }
    ],

    optimization: {
      minimize: true,
      minimizer: [new CssMinimizerPlugin()],
    },

    mode: 'production',
  };
};