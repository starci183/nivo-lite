#!/usr/bin/env node
// The local self-check of ext/ (`npm run ext:all` runs it first): the refusal list of the harness's extension loader (hfs 6.9.0,
// scripts/lib/project-ext.mts `loadProjectExt`, HFS_EXT_INVALID / HFS_EXT_API_MISMATCH, R381, PROJECT-LINT-3), enforced here while the lane runs
// hfs 6.8.5, which ignores ext/; so the folder cannot drift before the loader lands. It only adds strictness to the loader's list:
//   the loader's own list   schema `starci/project-ext@1`; `api` 1; no manifest key but schema, api, rules, checks, packages; no rule key but id,
//                           code, severity, doc, appliesTo, hfs, lint; id `APP-SHAPE-1` form, code `APP_SHAPE_INCOMPLETE` form; severity error
//                           or warning; doc a file below ext/ or an https link; appliesTo non-empty, app-relative, starting at a named folder or
//                           file; exactly one engine; hfs a kebab-case .mjs/.js file of ext/hfs/ that loads (require, as the loader) with a
//                           function as default export; lint exactly { tool: "eslint", file } with a file of ext/lint/ whose default export
//                           has create(); checks { id, run, why } only, kebab-case id, run `ext/checks/<name>.mjs` and there, ids and files
//                           unique; ids and codes unique; no code the harness reports; a module file of ext/hfs/ or ext/lint/ that no rule
//                           declares; a manifest that declares nothing.
//   stricter here           ANY file of ext/hfs/ or ext/lint/ that no rule declares (the loader counts kebab-case .mjs/.js files only); a file
//                           of ext/checks/ no check declares (the harness's R103); every appliesTo glob names a file extension in its last
//                           segment; every lint glob starts at be/, fe/ or packages/ (the three scopes the canon factories load rules for: a
//                           glob elsewhere is loaded by none); `packages` never declares a folder that still holds its packages/<name>/slots.yaml
//                           (HFS_PACKAGE_SLOTS_INVALID); a top-level entry of ext/ outside the app.ext slot's `allows` is a WARNING (see below).
// The reserved codes are the top-level keys of the failure-code catalog of the installed @starci/hfs (and of the harness copy given below).
// When a copy of the real loader can be imported as a pure module, it runs it too and prints its verdict:
//   node ext/support/validate-manifest.mjs                          local checks, plus the installed @starci/hfs loader when it has one (6.9.0+)
//   node ext/support/validate-manifest.mjs --harness <project-ext.mjs>   also the loader at that path (a harness worktree's runtime copy)
// Exit 1 on any error.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { ROOT } from "./program.mjs"

const EXT = join(ROOT, "ext")
const MANIFEST_KEYS = ["schema", "api", "rules", "checks", "packages"]
const RULE_KEYS = ["id", "code", "severity", "doc", "appliesTo", "hfs", "lint"]
const CHECK_KEYS = ["id", "run", "why"]
const ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/u
const CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u
const CHECK_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u
const CHECK_RUN = /^ext\/checks\/[a-z0-9][a-z0-9._-]*\.mjs$/u
const MODULE_FILE = /^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*\.(?:mjs|js)$/u
const LINT_SCOPES = ["be/", "fe/", "packages/"]
/** The top-level entries the harness's slot app.ext allows (knowledge/hfs/slots.yaml, hfs 6.9.0). */
const SLOT_ALLOWS = ["manifest.json", "README.md", "hfs", "lint", "checks", "docs"]

const errors = []
const warnings = []
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null)
const filesBelow = (dir, prefix = "") => {
    let entries
    try {
        entries = readdirSync(join(dir, prefix), { withFileTypes: true })
    } catch {
        return []
    }
    return entries.flatMap((entry) =>
        entry.isDirectory() ? filesBelow(dir, `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
    )
}
const require = createRequire(join(ROOT, "package.json"))
const loadDefault = (file) => {
    const loaded = require(join(ROOT, file))
    return loaded.default ?? loaded
}

/** The codes a failure-code catalog reports (its top-level keys). */
const codesOf = (file) => {
    try {
        return [...readFileSync(file, "utf8").matchAll(/^([A-Z][A-Z0-9_]+):\s*$/gmu)].map((match) => match[1])
    } catch {
        return []
    }
}
const harnessAt = process.argv.indexOf("--harness")
const harnessLoader = harnessAt === -1 ? null : resolve(process.argv[harnessAt + 1] ?? "")
const installedHfs = join(ROOT, "node_modules", "@starci", "hfs")
const catalogs = [
    join(installedHfs, "runtime", "modules", "kernel", "failure-codes.yaml"),
    ...(harnessLoader === null ? [] : [resolve(dirname(harnessLoader), "..", "..", "modules", "kernel", "failure-codes.yaml")]),
]
const reserved = new Set(catalogs.flatMap(codesOf))
if (reserved.size === 0) errors.push(`no failure-code catalog could be read (${catalogs.join(", ")}): the reserved codes are unknown`)

let manifest
try {
    manifest = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"))
} catch (error) {
    console.error(`ext manifest: ext/manifest.json cannot be read as JSON (${error.message})`)
    process.exit(1)
}

if (!plain(manifest) || manifest.schema !== "starci/project-ext@1") errors.push("schema must be starci/project-ext@1")
if (manifest.api !== 1) errors.push(`api must be 1, the extension API hfs 6.9.0 serves (found ${JSON.stringify(manifest.api)})`)
for (const key of Object.keys(manifest).filter((key) => !MANIFEST_KEYS.includes(key)))
    errors.push(`the manifest has the key ${key}; it holds only ${MANIFEST_KEYS.join(", ")}`)
if (manifest.rules !== undefined && !Array.isArray(manifest.rules)) errors.push("rules is a list")
if (manifest.packages !== undefined && !plain(manifest.packages)) errors.push("packages maps a packages/<name> folder to its slots")
const rules = Array.isArray(manifest.rules) ? manifest.rules : []
if (rules.length === 0 && manifest.checks === undefined && manifest.packages === undefined)
    errors.push("the manifest declares no rule, no check and no package")

const globProblem = (glob) => {
    if (typeof glob !== "string" || glob.trim() === "") return "is not a glob"
    if (glob.includes("\\") || glob.startsWith("/") || glob.startsWith("./") || glob.split("/").includes(".."))
        return `${glob} is not an app-relative path glob`
    if (!/^[A-Za-z0-9._-]+(?:\/|$)/u.test(glob)) return `${glob} must start at a named folder or file of the app root`
    if (!/\.[A-Za-z0-9{},]+$/u.test(glob.split("/").at(-1))) return `${glob} names no file extension in its last segment (stricter here)`
    return null
}

const declaredModules = { hfs: new Set(), lint: new Set() }
rules.forEach((rule, at) => {
    const label = plain(rule) && typeof rule.id === "string" ? rule.id : `rule ${at}`
    if (!plain(rule)) return errors.push(`${label} is not an object`)
    for (const key of Object.keys(rule).filter((key) => !RULE_KEYS.includes(key)))
        errors.push(`${label} has the key ${key}; a rule holds only ${RULE_KEYS.join(", ")}`)
    if (!ID.test(text(rule.id) ?? "")) errors.push(`${label}: id must be an upper-case law id such as APP-SHAPE-1`)
    if (!CODE.test(text(rule.code) ?? "")) errors.push(`${label}: code must be an upper-case finding code such as APP_SHAPE_INCOMPLETE`)
    if (reserved.has(rule.code)) errors.push(`${label}: ${rule.code} is a code the harness reports`)
    if (rule.severity !== "error" && rule.severity !== "warning") errors.push(`${label}: severity must be error or warning`)
    const doc = text(rule.doc)
    const docInExt = doc !== null && resolve(ROOT, doc).startsWith(`${EXT}${process.platform === "win32" ? "\\" : "/"}`) && existsSync(resolve(ROOT, doc))
    if (!(doc !== null && (/^https:\/\/\S+$/u.test(doc) || docInExt)))
        errors.push(`${label}: doc must be a file below ext/ or an https link (${String(rule.doc)})`)
    const globs = Array.isArray(rule.appliesTo) ? rule.appliesTo : []
    if (globs.length === 0) errors.push(`${label}: appliesTo must list the app-relative globs the rule judges`)
    for (const glob of globs) {
        const problem = globProblem(glob)
        if (problem !== null) errors.push(`${label}: appliesTo ${problem}`)
        if (rule.lint !== undefined && typeof glob === "string" && !LINT_SCOPES.some((scope) => glob.startsWith(scope)))
            errors.push(`${label}: appliesTo ${glob} starts at none of ${LINT_SCOPES.join(", ")}, so no canon config loads the rule there (stricter here)`)
    }
    const engines = ["hfs", "lint"].filter((key) => rule[key] !== undefined)
    if (engines.length !== 1) errors.push(`${label}: a rule has exactly one engine, hfs or lint`)
    if (rule.hfs !== undefined) {
        if (typeof rule.hfs !== "string" || !MODULE_FILE.test(rule.hfs)) errors.push(`${label}: hfs must name a kebab-case .mjs/.js file of ext/hfs/`)
        else {
            declaredModules.hfs.add(rule.hfs)
            const file = `ext/hfs/${rule.hfs}`
            if (!existsSync(join(ROOT, file))) errors.push(`${label}: ${file} is declared and is not there`)
            else
                try {
                    if (typeof loadDefault(file) !== "function") errors.push(`${label}: ${file} must export by default a function (context) => findings`)
                } catch (error) {
                    errors.push(`${label}: ${file} cannot be loaded by require, as the loader loads it (${String(error.message).split("\n")[0]})`)
                }
        }
    }
    if (rule.lint !== undefined) {
        const lint = rule.lint
        if (!plain(lint) || Object.keys(lint).some((key) => key !== "tool" && key !== "file")) errors.push(`${label}: lint is { tool, file }`)
        else if (lint.tool !== "eslint") errors.push(`${label}: lint.tool must be eslint, the one lint tool of extension API 1`)
        else if (typeof lint.file !== "string" || !MODULE_FILE.test(lint.file)) errors.push(`${label}: lint.file must name a kebab-case .mjs/.js file of ext/lint/`)
        else {
            declaredModules.lint.add(lint.file)
            const file = `ext/lint/${lint.file}`
            if (!existsSync(join(ROOT, file))) errors.push(`${label}: ${file} is declared and is not there`)
            else
                try {
                    const loaded = loadDefault(file)
                    if (!plain(loaded) || typeof loaded.create !== "function") errors.push(`${label}: ${file} must export by default an ESLint rule with create()`)
                } catch (error) {
                    errors.push(`${label}: ${file} cannot be loaded by require, as the loader loads it (${String(error.message).split("\n")[0]})`)
                }
        }
    }
})
for (const [field, name] of [["id", "id"], ["code", "code"]]) {
    const seen = new Set()
    for (const rule of rules.filter(plain)) {
        if (seen.has(rule[field])) errors.push(`${rule.id}: the ${name} ${rule[field]} is declared twice`)
        seen.add(rule[field])
    }
}
for (const engine of ["hfs", "lint"])
    for (const file of filesBelow(join(EXT, engine)))
        if (!declaredModules[engine].has(file))
            errors.push(`ext/${engine}/${file} is declared by no rule of the manifest (the loader refuses a module file; this check refuses any file)`)

if (manifest.checks !== undefined) {
    if (!Array.isArray(manifest.checks) || manifest.checks.length === 0) errors.push("checks is a non-empty list of { id, run, why }")
    const checks = Array.isArray(manifest.checks) ? manifest.checks : []
    const ids = new Set()
    const runs = new Set()
    checks.forEach((check, at) => {
        const label = plain(check) && typeof check.id === "string" ? `check ${check.id}` : `check ${at}`
        if (!plain(check) || Object.keys(check).some((key) => !CHECK_KEYS.includes(key)) || !CHECK_ID.test(check.id ?? "") ||
            !CHECK_RUN.test(check.run ?? "") || text(check.why) === null)
            return errors.push(`${label}: a check is { id, run, why }: a kebab-case id, run an ext/checks/<name>.mjs file, what it guards`)
        if (ids.has(check.id)) errors.push(`${label}: the id is declared twice`)
        if (runs.has(check.run)) errors.push(`${label}: ${check.run} is the file of another check too`)
        if (!existsSync(join(ROOT, check.run))) errors.push(`${label}: ${check.run} is declared and is not there`)
        ids.add(check.id)
        runs.add(check.run)
    })
    for (const file of filesBelow(join(EXT, "checks")))
        if (!runs.has(`ext/checks/${file}`)) errors.push(`ext/checks/${file} is declared by no check (HFS_REPO_LOCAL_CHECK, R103)`)
}

for (const folder of Object.keys(plain(manifest.packages) ? manifest.packages : {}))
    if (existsSync(join(ROOT, folder, "slots.yaml")))
        errors.push(`packages declares ${folder}, which still holds ${folder}/slots.yaml: declared in both places is HFS_PACKAGE_SLOTS_INVALID; delete the file in the same commit`)

for (const entry of readdirSync(EXT).filter((name) => !SLOT_ALLOWS.includes(name)))
    warnings.push(`ext/${entry}${statSync(join(EXT, entry)).isDirectory() ? "/" : ""} is outside the entries the harness's slot app.ext allows (${SLOT_ALLOWS.join(", ")}); no 6.9.0 checker enforces that list for app.ext, but it is the slot's declaration`)

/** Runs a real loader (scripts/lib/project-ext.mjs of a harness copy) against this app, printing its verdict; its problems are errors. */
const runLoader = async (file, name) => {
    if (!existsSync(file)) return false
    const loader = await import(pathToFileURL(file).href)
    const result = loader.loadProjectExt(ROOT)
    const verdict = result.problems.length === 0
        ? `accepted: ${result.rules.length} rules (${result.rules.filter((rule) => rule.hfs !== undefined).length} hfs, ${result.rules.filter((rule) => rule.lint !== undefined).length} lint as ${result.rules.filter((rule) => rule.lint !== undefined).map((rule) => `project-ext/${rule.lint.name}`).join(", ")}), ${result.checks.length} checks, ${Object.keys(result.packages).length} packages`
        : `REFUSED: ${result.problems.map((problem) => `${problem.code} ${problem.message}`).join("; ")}`
    console.log(`ext manifest: the real loader (${name}) ${verdict}`)
    for (const problem of result.problems) errors.push(`real loader (${name}): ${problem.code} ${problem.message}`)
    return true
}
const installedLoader = join(installedHfs, "runtime", "scripts", "lib", "project-ext.mjs")
if (!(await runLoader(installedLoader, "installed @starci/hfs")))
    console.log("ext manifest: the installed @starci/hfs has no extension loader (it is older than 6.9.0); local checks only")
if (harnessLoader !== null && !(await runLoader(harnessLoader, harnessLoader))) errors.push(`--harness ${harnessLoader} is not there`)

for (const warning of warnings) console.warn(`ext manifest: warning: ${warning}`)
if (errors.length > 0) {
    for (const error of errors) console.error(`ext manifest: ${error}`)
    console.error(`ext manifest: FAILED, ${errors.length} problems`)
    process.exit(1)
}
console.log(
    `ext manifest: OK, ${rules.length} rules, ${(manifest.checks ?? []).length} checks, ${reserved.size} reserved harness codes avoided`,
)
