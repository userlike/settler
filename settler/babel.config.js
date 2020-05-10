module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: { node: "8.3" },
        modules: "commonjs",
      },
    ],
    "@babel/preset-typescript",
  ],
  plugins: ["babel-plugin-macros"],
};
