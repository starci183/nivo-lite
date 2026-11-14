// The RuleTester of the project lint rules (ext/lint/) on node's own test runner (`node --test`), with the TypeScript parser the lane already installs.
import { describe, it } from "node:test"
import { resolve } from "node:path"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { ROOT } from "../support/lint-shared.mjs"

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

export const tester = new RuleTester({
    languageOptions: {
        parser: tsParser,
        parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
})

/** An absolute file name under the lane root, so a rule's path scope reads it as the real file would be. */
export const at = (rel) => resolve(ROOT, rel)
