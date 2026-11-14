// ext/manifest.json rule NIVO-EXT-1 (doc ext/docs/NIVO-EXT-1.md), code NIVO_EXT_CONCEPT_UNKNOWN: every project rule and check of this
// extension cites a concept topic file that exists, and every lint rule cites the same files as its doc.
// The harness contract (hfs 6.9.0, scripts/lib/project-ext.mts): the default export is `(context) => findings`, called with
// `context = { api, repoRoot, files, read }` (`files`: the tracked files `appliesTo` matches; `read(file)`: the text of an app-relative file,
// or null) and returning `{ path, message, line?, column? }[]`. It runs synchronously (the harness loads it with require): no top-level await.
// It reads the manifest, the docs and the concept files through `context.read`; it reads them by the paths the manifest names rather than
// through `files`, so an untracked doc of an uncommitted lane is judged too (the harness's `files` holds tracked files only).
//   - `.starciwork/concepts/README.md` (the concept catalog) exists;
//   - a rule's doc (`doc`, a file below ext/) and a check's doc (ext/docs/checks/<id>.md: the manifest gives a check no doc key) open with a
//     YAML front matter `--- … ---` naming `rule: <id>` / `check: <id>` and `concept: [<path>, ...]`, at least one;
//   - a citation is the path of a concept topic file, `.starciwork/concepts/<topic>.md`, and that file exists (README.md is no topic);
//   - a lint rule (ext/lint/<file>) names in `meta.docs.concept` the same paths as its doc.
// Concept: .starciwork/concepts/project-ext.md (the concept of this extension itself).
//   valid:   ---\nrule: NIVO-NAMES-1\nconcept:\n  - .starciwork/concepts/tools.md\n---
//   invalid: .starciwork/concepts/noSuchTopic.md   (no such file)
//   invalid: a front matter with no concept list
import { createRequire } from "node:module"
import { join } from "node:path"
import { parse } from "yaml"

const MANIFEST = "ext/manifest.json"
const CATALOG = ".starciwork/concepts/README.md"
const TOPIC = /^\.starciwork\/concepts\/([A-Za-z0-9-]+)\.md$/
const checkDocOf = (id) => `ext/docs/checks/${id}.md`

const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value)

/** The YAML front matter of a markdown text (`---` line, YAML, `---` line), parsed; null when the text opens with none or it is no YAML. */
export const frontMatterOf = (text) => {
    const lines = text.split(/\r?\n/)
    if (lines[0] !== "---") return null
    const end = lines.indexOf("---", 1)
    if (end === -1) return null
    try {
        const parsed = parse(lines.slice(1, end).join("\n"))
        return plain(parsed) ? parsed : null
    } catch {
        return null
    }
}

/** A concept field as a list of citations (one string, or a list). */
const referencesOf = (concept) => (Array.isArray(concept) ? concept : concept === undefined || concept === null ? [] : [concept])

/** The rule of the harness contract. */
export default function conceptTopics(context) {
    const findings = []
    const report = (path, message) => findings.push({ path, message })

    let manifest
    try {
        manifest = JSON.parse(context.read(MANIFEST) ?? "")
    } catch {
        report(MANIFEST, `${MANIFEST} cannot be read as JSON`)
        return findings
    }

    if (context.read(CATALOG) === null || context.read(CATALOG) === undefined) {
        report(CATALOG, `${CATALOG} is missing: no concept citation can be proved`)
        return findings
    }
    const referenceProblem = (reference) => {
        if (typeof reference !== "string") return "a concept citation is the path `.starciwork/concepts/<topic>.md`"
        const match = TOPIC.exec(reference)
        if (match === null || reference === CATALOG) return `${reference}: not the path of a concept topic file (.starciwork/concepts/<topic>.md)`
        const text = context.read(reference)
        if (text === null || text === undefined) return `${reference}: that concept topic file does not exist`
        return null
    }
    /** The citations a doc names, after judging it; null when the doc cannot be judged. */
    const judgeDoc = (doc, field, id, label) => {
        const text = context.read(doc)
        if (text === null || text === undefined) {
            report(MANIFEST, `${label}: its doc ${doc} is missing`)
            return null
        }
        const front = frontMatterOf(text)
        if (front === null) {
            report(doc, `${doc} opens with no YAML front matter (--- ${field}: ${id} / concept: [<topic path>, ...] ---)`)
            return null
        }
        if (front[field] !== id) report(doc, `${doc} names ${field} ${JSON.stringify(front[field])}, the manifest ${label}`)
        const references = referencesOf(front.concept)
        if (references.length === 0) report(doc, `${label}: ${doc} cites no concept topic file`)
        for (const reference of references) {
            const problem = referenceProblem(reference)
            if (problem !== null) report(doc, `${label}: ${problem}`)
        }
        return references
    }

    const load = createRequire(join(context.repoRoot, "package.json"))
    for (const rule of Array.isArray(manifest.rules) ? manifest.rules : []) {
        if (!plain(rule) || typeof rule.id !== "string") continue
        const label = `rule ${rule.id}`
        // An https doc is the harness's other doc form; this extension keeps every doc in ext/ so its citations can be proved.
        if (typeof rule.doc !== "string" || !rule.doc.startsWith("ext/")) {
            report(MANIFEST, `${label}: doc ${String(rule.doc)} is no file below ext/, so its concept citations cannot be proved`)
            continue
        }
        const references = judgeDoc(rule.doc, "rule", rule.id, label)
        if (references === null || !plain(rule.lint) || typeof rule.lint.file !== "string") continue
        const file = `ext/lint/${rule.lint.file}`
        let named
        try {
            const loaded = load(join(context.repoRoot, file))
            named = referencesOf((loaded.default ?? loaded)?.meta?.docs?.concept)
        } catch (error) {
            report(file, `${file} cannot be loaded (${String(error?.message ?? error).split("\n")[0]})`)
            continue
        }
        const same = named.length === references.length && named.every((reference) => references.includes(reference))
        if (!same)
            report(file, `${file} names ${JSON.stringify(named)} in meta.docs.concept, its doc ${rule.doc} ${JSON.stringify(references)}`)
    }
    for (const check of Array.isArray(manifest.checks) ? manifest.checks : []) {
        if (!plain(check) || typeof check.id !== "string") continue
        judgeDoc(checkDocOf(check.id), "check", check.id, `check ${check.id}`)
    }
    return findings
}
