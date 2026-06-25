import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { window: true, document: true, localStorage: true, fetch: true, console: true },
    },
    settings: { react: { version: "detect" } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-console": ["error", { allow: ["error"] }],
      "react/react-in-jsx-scope": "off",
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/no-children-prop": "error",
      "react/no-danger-with-children": "error",
      "react/no-deprecated": "warn",
      "react/no-direct-mutation-state": "error",
      "react/no-unescaped-entities": "error",
      "react/no-unknown-property": "error",
      "react/prop-types": "off",
      "react/self-closing-comp": "error",
      "prefer-const": "error",
      "no-nested-ternary": "error",
      "no-else-return": "error",
      "max-params": "error",
    },
  },
];
