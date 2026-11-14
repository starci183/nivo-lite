#!/usr/bin/env node
// ext/manifest.json check `crm-names` (doc ext/docs/checks/crm-names.md): a CRM is a provider connected through its OpenAPI document, and every
// operation of it has ONE name, `nivo.api.crm.<crmId>.<method>.<path>` (owner chốt 2026-11-13). Pure node: the derivation is the SDK's
// (`crmOpsOf` + `crmNamesTextOf` of `@nivo-lite/agent-sdk/names`, from its dist), the same one the engine and a package's codegen use.
// For every package under `packages/*` that pins a document `src/crm/<id>/openapi.json`:
//   (a) `src/crm/<id>/api.generated.ts` equals what the SDK writes for the document (the codegen is current);
//   (b) every `nivo.api.crm.<id>.<rest>` text in the package's `src/**/*.ts` names an operation of the document of a template the SAME
//       package declares for `<id>`: a package that uses another package's CRM id, or an id it declares no template for, is a finding;
//   (c) the provider templates the plugins declare (`defineProviderTemplate` in `providers`, owner chốt 2026-11-14, read from the built
//       packages): each template's `src/crm/<id>/openapi.json` exists and equals its `openapi`; no pinned folder lacks its template;
//   (d) template ids are unique across packages (and two packages never pin the same `<id>` folder).
// The decisions of (b)-(d) are ext/support/crm-names-rules.mjs, judged on fixtures by ext/tests/crm-names.spec.mjs.
// Also a hand-named `nivo.tool.crm.` text anywhere in `packages/*/src`, `be/src`, `fe/apps/*/src` is a finding. Findings print as file:line.
// No arguments. It BUILDS FIRST (the SDK is read from its dist and the check contract has no `needs`): `npm run build:modules`,
// idempotent through turbo's cache, dist/ only. Exit 0 = no finding; exit 1 = at least one; otherwise the build's status.
// Concept: .starciwork/concepts/tools.md and providers.md (a CRM provider via OpenAPI: `nivo.api.crm.<crmId>.<method>.<path>`).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { buildModules } from "../support/program.mjs"
import { templateFindings, usedOpFindings } from "../support/crm-names-rules.mjs"

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))

const built = buildModules()
if (built !== 0) process.exit(built)

const { crmNamesTextOf, crmOpsOf } = createRequire(join(ROOT, "package.json"))("@nivo-lite/agent-sdk/names")

/** The directories a walk does not enter. */
const SKIPPED = new Set(["node_modules", "dist", ".next", ".turbo", "coverage"])

/** Every `.ts` / `.tsx` file under a directory (none when it does not exist). */
const sourcesUnder = (dir) => {
    if (!existsSync(dir)) return []
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (SKIPPED.has(name)) return []
        if (statSync(path).isDirectory()) return sourcesUnder(path)
        return /\.tsx?$/u.test(name) ? [path] : []
    })
}

/** The immediate sub-directories of a directory (none when it does not exist). */
const dirsUnder = (dir) =>
    existsSync(dir) ? readdirSync(dir).filter((name) => !SKIPPED.has(name) && statSync(join(dir, name)).isDirectory()) : []

const rel = (path) => relative(ROOT, path).split(sep).join("/")
const findings = []
const find = (path, line, text) => {
    const finding = `${rel(path)}${line === null ? "" : `:${line}`}: ${text}`
    if (!findings.includes(finding)) findings.push(finding)
}

/** The line number, the match and the line's text of every match of a pattern in a text. */
const linesOf = (text, pattern) =>
    text.split(/\r?\n/u).flatMap((line, index) => [...line.matchAll(pattern)].map((match) => ({ line: index + 1, match, text: line })))

const packages = dirsUnder(join(ROOT, "packages")).map((name) => ({ name, dir: join(ROOT, "packages", name), pins: new Map() }))

// (a) the pins and their generated files
/** crm id -> the packages pinning it. */
const pinned = new Map()
for (const pkg of packages) {
    const crmDir = join(pkg.dir, "src", "crm")
    for (const id of dirsUnder(crmDir)) {
        const documentPath = join(crmDir, id, "openapi.json")
        if (!existsSync(documentPath)) continue
        pinned.set(id, [...(pinned.get(id) ?? []), pkg.name])
        const reading = crmOpsOf(JSON.parse(readFileSync(documentPath, "utf8")), id)
        if (!reading.ok) {
            find(documentPath, null, `the document gives no operations of CRM \`${id}\`: ${reading.problem}${reading.at === null ? "" : ` at ${reading.at}`}`)
            continue
        }
        pkg.pins.set(id, new Set(reading.entries.map((entry) => entry.op)))
        const generatedPath = join(crmDir, id, "api.generated.ts")
        const expected = crmNamesTextOf(id, reading.basePath, reading.entries)
        const actual = existsSync(generatedPath) ? readFileSync(generatedPath, "utf8") : null
        if (actual !== expected) {
            find(
                actual === null ? documentPath : generatedPath,
                null,
                `api.generated.ts ${actual === null ? "is missing" : "differs from"} what openapi.json gives (${reading.entries.length} operations); run \`npm run crm:codegen\` in packages/${pkg.name}`,
            )
        }
    }
}

// (b) the CRM operation names every package's sources use
const CRM_TEXT = /nivo\.api\.crm\.([a-z][a-z0-9-]*)((?:\.[A-Za-z0-9_-]+)*)/gu
/** package -> its uses `{ file, line, text, id, rest }`. */
const usesOf = new Map()
for (const pkg of packages) {
    const uses = []
    for (const file of sourcesUnder(join(pkg.dir, "src"))) {
        if (rel(file).endsWith("/api.generated.ts")) continue
        // A package that pins no document (the SDK that defines the law, the core) is judged on its code only: its comments and its specs
        // use CRM names as examples.
        if (pkg.pins.size === 0 && /\.spec\.tsx?$/u.test(file)) continue
        for (const { line, match, text: row } of linesOf(readFileSync(file, "utf8"), CRM_TEXT)) {
            if (pkg.pins.size === 0 && /^\s*(\*|\/\/|\/\*)/u.test(row)) continue
            const [text, id, rest] = match
            uses.push({ file, line, text, id, rest })
        }
    }
    usesOf.set(pkg, uses)
}

// (c) the templates the plugins declare (`defineProviderTemplate` in a plugin's `providers`, read from the built packages): ids unique across
// packages, each one's pinned document present and equal to its `openapi`, no pinned folder without its template. Then every use of (b) is
// judged against the templates the SAME package declares (an op of another package's CRM, or one the pinned document lacks, is a finding).
const requireRoot = createRequire(join(ROOT, "package.json"))
const rootManifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
/** The core package exports `corePlugin`; every other plugin `plugin` (scripts/build-plugin-registry.mjs). */
const pluginExports = new Map([["@nivo-lite/blocks-core", "corePlugin"], ...(rootManifest.nivo?.plugins ?? []).map((name) => [name, "plugin"])])
const declaredOf = packages.map((pkg) => {
    const npmName = JSON.parse(readFileSync(join(pkg.dir, "package.json"), "utf8")).name
    const exportName = pluginExports.get(npmName)
    const plugin = exportName === undefined ? null : requireRoot(npmName)[exportName]
    const templates = (plugin?.providers ?? []).map((template) => ({ kind: template.kind, id: template.id, openapi: template.openapi }))
    const pinnedDocs = new Map([...pkg.pins.keys()].map((id) => [id, JSON.parse(readFileSync(join(pkg.dir, "src", "crm", id, "openapi.json"), "utf8"))]))
    return { pkg, name: pkg.name, templates, pinned: pinnedDocs }
})
for (const finding of templateFindings(declaredOf)) find(join(ROOT, "packages", finding.pkg, "src", "plugin.ts"), null, finding.text)
for (const [id, names] of pinned) {
    if (names.length > 1) find(join(ROOT, "packages"), null, `CRM id \`${id}\` is pinned by ${names.length} packages (${names.join(", ")}); a CRM id is globally unique`)
}
for (const declared of declaredOf) {
    const ops = new Map(
        declared.templates.map((template) => {
            const reading = crmOpsOf(template.openapi, template.id)
            return [template.id, new Set(reading.ok ? reading.entries.map((entry) => entry.op) : [])]
        }),
    )
    for (const use of usedOpFindings(usesOf.get(declared.pkg) ?? [], ops)) find(use.file, use.line, use.problem)
}

// no hand-named `nivo.tool.crm.` anywhere
const HAND_NAMED = /nivo\.tool\.crm\./gu
const roots = [
    ...packages.map((pkg) => join(pkg.dir, "src")),
    join(ROOT, "be", "src"),
    ...dirsUnder(join(ROOT, "fe", "apps")).map((name) => join(ROOT, "fe", "apps", name, "src")),
]
for (const root of roots) {
    for (const file of sourcesUnder(root)) {
        for (const { line } of linesOf(readFileSync(file, "utf8"), HAND_NAMED)) {
            find(file, line, "a hand-named `nivo.tool.crm.` text: a CRM operation is `nivo.api.crm.<crmId>.<method>.<path>`, generated, never typed")
        }
    }
}

if (findings.length === 0) {
    const ids = [...pinned.keys()]
    console.log(`crm names: ${ids.length} pinned CRM document${ids.length === 1 ? "" : "s"} (${ids.join(", ")}); generated names current, every used operation pinned, ids unique`)
} else {
    for (const finding of findings) console.error(`crm names: ${finding}`)
    console.error(`crm names: ${findings.length} finding${findings.length === 1 ? "" : "s"}`)
    process.exitCode = 1
}
