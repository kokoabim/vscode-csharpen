import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
    {
        files: ["**/*.ts"],
        ignores: [
            "**/dist/**/*",
            "**/node_modules/**/*",
            "**/test/**/*"
        ],

        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module",
        },

        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-function-return-type": "warn",
            "@typescript-eslint/naming-convention": ["warn", {
                selector: "import",
                format: ["camelCase", "PascalCase"],
            }],
            "@typescript-eslint/no-unused-expressions": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-namespace": "off",

            "curly": [
                "warn",
                "multi-line"
            ],
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "no-unreachable": "warn",
            "no-unused-expressions": "warn",
            "semi": "warn",
            "prefer-const": "warn",
            "no-undef": "off",
            "no-empty": "off",
            "no-unused-vars": "off",
        },
    }
];