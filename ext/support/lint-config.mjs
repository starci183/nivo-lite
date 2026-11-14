// The standalone flat config of the project lint rules ONLY (`npm run ext:lint`): no canon, so no other finding mixes in. It is built the way
// the harness builds its blocks (hfs 6.9.0 scripts/lib/project-ext.mts `extEslintConfigs`): every rule of ext/manifest.json with a `lint`
// engine, its module `ext/lint/<lint.file>` loaded by default export, registered under the plugin `project-ext` as the file's name without
// its extension (`/` → `-`), one block per rule over its `appliesTo` globs at its severity (error → "error", warning → "warn"). The one
// difference: the harness hands each canon config (be/, fe/, packages/) only the globs inside its own folder; this config takes them all at
// once from the app root, which is the same union (ext/support/validate-manifest.mjs refuses a lint glob outside those three folders).
// It is additive: the managed configs still judge every file; this config only runs the project's rules until the canon loads them.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import tsParser from "@typescript-eslint/parser"
import { ROOT } from "./lint-shared.mjs"

/** The plugin name the harness loads the rules under. */
export const PLUGIN_NAME = "project-ext"

/** The rule name of a lint file, as the harness derives it. */
export const ruleNameOf = (file) => file.replace(/\.(?:mjs|js)$/u, "").replace(/\//gu, "-")

const manifest = JSON.parse(readFileSync(resolve(ROOT, "ext", "manifest.json"), "utf8"))

/** The manifest's lint rules: { id, name, severity, appliesTo, rule }. */
export const lintRules = await Promise.all(
    manifest.rules
        .filter((entry) => entry.lint !== undefined)
        .map(async (entry) => ({
            id: entry.id,
            name: ruleNameOf(entry.lint.file),
            severity: entry.severity === "error" ? "error" : "warn",
            appliesTo: entry.appliesTo,
            rule: (await import(pathToFileURL(resolve(ROOT, "ext", "lint", entry.lint.file)).href)).default,
        })),
)

const plugin = { meta: { name: PLUGIN_NAME }, rules: Object.fromEntries(lintRules.map((entry) => [entry.name, entry.rule])) }

/** Never linted: build output and dependencies. */
const ALWAYS_IGNORED = ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.turbo/**", "**/coverage/**", "**/*.d.ts"]

export const extLintConfig = () => [
    { ignores: ALWAYS_IGNORED },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
        },
        linterOptions: { reportUnusedDisableDirectives: "off" },
    },
    ...lintRules.map((entry) => ({
        name: `${PLUGIN_NAME}/${entry.name} (${entry.id})`,
        files: entry.appliesTo,
        plugins: { [PLUGIN_NAME]: plugin },
        rules: { [`${PLUGIN_NAME}/${entry.name}`]: entry.severity },
    })),
]

export default extLintConfig()
