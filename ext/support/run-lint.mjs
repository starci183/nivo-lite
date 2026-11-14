#!/usr/bin/env node
// `npm run ext:lint`: ESLint with ONLY the project lint rules (ext/support/lint-config.mjs: the rules of ext/manifest.json with a `lint`
// engine, under the plugin `project-ext`, as the harness loads them) over their `appliesTo` globs. Additive to the canon: the managed configs
// still judge every file; this run adds the project's rules and reports nothing else. From hfs 6.9.0 the canon factories load the same rules
// inside `starci app check`'s lint gate, so this run becomes the developer's shortcut to them.
//   node ext/support/run-lint.mjs                 every lint rule over its appliesTo
//   node ext/support/run-lint.mjs <path> ...      only these files or folders (a staged set, one package)
//   node ext/support/run-lint.mjs --json <file>   also writes the findings as JSON (rule, id, file, line, message)
// Exit 1 when any finding is reported.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { ESLint } from "eslint"
import { PLUGIN_NAME, lintRules } from "./lint-config.mjs"
import { ROOT } from "./lint-shared.mjs"

const args = process.argv.slice(2)
const jsonAt = args.indexOf("--json")
const jsonFile = jsonAt === -1 ? null : args[jsonAt + 1]
const paths = args.filter((arg, index) => arg !== "--json" && index !== jsonAt + 1)

const patterns = paths.length > 0 ? paths : [...new Set(lintRules.flatMap((entry) => entry.appliesTo))]
const idOf = new Map(lintRules.map((entry) => [`${PLUGIN_NAME}/${entry.name}`, entry.id]))

const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: resolve(ROOT, "ext", "support", "lint-config.mjs"),
    errorOnUnmatchedPattern: false,
    warnIgnored: false,
    cache: false,
})
// Only the ext rules' findings and fatal parse errors count: a canon directive in a file (`eslint-disable-next-line <canon rule>`)
// names a rule this config does not load, which is the canon's business, not this run's.
const results = (await eslint.lintFiles(patterns)).map((result) => {
    const messages = result.messages.filter(
        (message) => message.fatal === true || message.ruleId?.startsWith(`${PLUGIN_NAME}/`) === true,
    )
    const errorCount = messages.filter((message) => message.severity === 2).length
    return {
        ...result,
        messages,
        errorCount,
        warningCount: messages.length - errorCount,
        fatalErrorCount: messages.filter((m) => m.fatal).length,
    }
})
const findings = results.flatMap((result) =>
    result.messages.map((message) => ({
        rule: message.ruleId ?? "(parse)",
        id: idOf.get(message.ruleId) ?? null,
        file: relative(ROOT, result.filePath).split("\\").join("/"),
        line: message.line,
        column: message.column,
        message: message.message,
    })),
)
const formatter = await eslint.loadFormatter("stylish")
const text = await formatter.format(results)
if (text) process.stdout.write(text)
if (jsonFile) {
    mkdirSync(dirname(resolve(jsonFile)), { recursive: true })
    writeFileSync(resolve(jsonFile), `${JSON.stringify(findings, null, 2)}\n`)
}
const byRule = new Map()
for (const finding of findings) {
    const key = finding.id === null ? finding.rule : `${finding.id} ${finding.rule}`
    byRule.set(key, (byRule.get(key) ?? 0) + 1)
}
const byFile = new Map()
for (const finding of findings) byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + 1)
const linted = results.length
if (findings.length === 0) {
    console.log(`ext lint: ${linted} files, ${lintRules.length} rules, 0 findings`)
} else {
    console.error(
        `ext lint: ${linted} files, ${lintRules.length} rules, ${findings.length} findings: ${[...byRule].map(([rule, count]) => `${rule} ${count}`).join(", ")}`,
    )
    for (const [file, count] of byFile) console.error(`  ${file}: ${count}`)
    process.exitCode = 1
}
