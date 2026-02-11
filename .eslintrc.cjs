module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  ignorePatterns: ["dist", "node_modules", "*.cjs"],
  overrides: [
    {
      files: ["*.ts"],
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    },
  ],
};
