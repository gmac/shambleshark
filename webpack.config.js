/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/camelcase */
const webpack = require("webpack");
const path = require("path");
const fileSystem = require("fs");
const env = require("./utils/env");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const WriteFilePlugin = require("write-file-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ForkTsCheckerNotifierWebpackPlugin = require("fork-ts-checker-notifier-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

const BROWSER = env.BROWSER;

// NOTE: whenever you add an alias here, you also need to add the
// corresponding alias to the paths field in the tsconfig
// TODO: should probably do that programatically
const alias = {
  Constants: path.resolve(__dirname, "src/js/resources/constants.js"),
  Feature: path.resolve(__dirname, "src/js/features/feature.js"),
  Features: path.resolve(__dirname, "src/js/features/"),
  Lib: path.resolve(__dirname, "src/js/lib/"),
  Ui: path.resolve(__dirname, "src/js/lib/ui-elements/"),
  Svg: path.resolve(__dirname, "src/js/resources/svg.js"),
};

if (BROWSER === "GOOGLE_CHROME") {
  alias.Browser = path.resolve(__dirname, "src/js/lib/chrome/");
} else if (BROWSER === "FIREFOX") {
  alias.Browser = path.resolve(__dirname, "src/js/lib/firefox/");
}

const secretsPath = path.join(__dirname, "secrets." + env.NODE_ENV + ".js");

const fileExtensions = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "eot",
  "otf",
  "svg",
  "ttf",
  "woff",
  "woff2",
];

if (fileSystem.existsSync(secretsPath)) {
  alias.secrets = secretsPath;
}

const options = {
  context: process.cwd(),
  mode: env.NODE_ENV,
  optimization: {
    // extensions don't receive a performance boost by doing this
    // and Firefox requires extension code to be unminified
    minimize: false,
  },
  entry: {
    popup: path.join(__dirname, "src", "js", "popup.ts"),
    options: path.join(__dirname, "src", "js", "options", "index.ts"),
    background: path.join(__dirname, "src", "js", "background", "index.ts"),
    scryfallEmbed: path.join(
      __dirname,
      "src",
      "js",
      "scryfall-embed",
      "index.ts"
    ),
    scryfall: path.join(__dirname, "src", "js", "scryfall", "index.ts"),
    edhrec: path.join(__dirname, "src", "js", "edhrec", "index.ts"),
  },
  output: {
    path: path.join(__dirname, "build", BROWSER.toLowerCase()),
    filename: "[name].bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: "../",
              hmr: process.env.NODE_ENV !== "production",
            },
          },
          "css-loader",
        ],
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [{ loader: "ts-loader", options: { transpileOnly: true } }],
      },
      {
        test: new RegExp(".(" + fileExtensions.join("|") + ")$"), // eslint-disable-line
        loader: "file-loader?name=[name].[ext]",
        exclude: /node_modules/,
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/,
      },
      {
        enforce: "post",
        loader: "string-replace-loader",
        options: {
          search: 'new Function("return this")()',
          replace: "null",
        },
        test: /\.js$/,
      },
    ],
  },
  resolve: {
    alias: alias,
    extensions: [".ts", ".js"],
    plugins: [
      new TsconfigPathsPlugin({
        // TODO: if we generate the tsconfig programtically
        // for the path resolution, than enable this
        /*configFile: "./path/to/tsconfig.json" */
      }),
    ],
  },
  plugins: [
    // clean the build folder
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ["!*manifest.json"],
      cleanAfterEveryBuildPatterns: ["!*manifest.json"],
    }),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.EnvironmentPlugin(["NODE_ENV"]),
    new ForkTsCheckerWebpackPlugin({
      eslint: true,
    }),
    new ForkTsCheckerNotifierWebpackPlugin({
      title: "TypeScript",
      excludeWarnings: false,
    }),
    new CopyWebpackPlugin([
      {
        from: "src/manifest.json",
        transform: function (content, path) {
          const json = {
            // generates the manifest file using the package.json informations
            description: process.env.npm_package_description,
            version: process.env.npm_package_version,
            content_security_policy: "script-src 'self'; object-src 'self'",
            ...JSON.parse(content.toString()),
          };
          if (BROWSER === "FIREFOX") {
            json.browser_specific_settings = {
              gecko: {
                id: "blade@crookedneighbor.com",
                strict_min_version: "69.0",
              },
            };
          }

          if (env.NODE_ENV !== "production") {
            // so the background script can hot-reload
            json.content_security_policy =
              "script-src 'self' 'unsafe-eval'; object-src 'self'";
          }

          return Buffer.from(JSON.stringify(json));
        },
      },
    ]),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "popup.html"),
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "options.html"),
      filename: "options.html",
      chunks: ["options"],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "background.html"),
      filename: "background.html",
      chunks: ["background"],
    }),
    new MiniCssExtractPlugin(),
    new WriteFilePlugin(),
  ],
};

if (env.NODE_ENV === "development") {
  options.devtool = "cheap-module-eval-source-map";
}

module.exports = options;
