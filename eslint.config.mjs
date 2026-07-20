export default [
  { ignores: ["dist-web/**", "dist-electron/**", "release/**", "node_modules/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: (await import("@typescript-eslint/parser")).default, parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } } },
    plugins: { "@typescript-eslint": (await import("@typescript-eslint/eslint-plugin")).default },
    rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }] }
  }
];
