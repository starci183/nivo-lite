// The hfs rule NIVO-EXT-1 (ext/hfs/concept-keys.mjs) on a context built like the harness's, over an in-memory tree, plus one run over the
// real extension (it must report nothing).
import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { test } from "node:test"
import conceptKeys, { frontMatterOf } from "../hfs/concept-keys.mjs"
import { ROOT } from "../support/lint-shared.mjs"

const TOOLS = ".starciwork/concepts/tools.md"
const doc = (field, id, concept) => `---\n${field}: ${id}\nconcept:\n${concept.map((c) => `  - ${c}`).join("\n")}\n---\n\n# x\n`

/** A context over `tree` (app-relative file → text); `repoRoot` is the real app root so a declared lint file loads. */
const contextOf = (tree) => ({ api: 1, repoRoot: ROOT, files: Object.keys(tree), read: (file) => tree[file] ?? null })
const treeOf = ({ manifest, docs = {}, readme = true }) => ({
    "ext/manifest.json": JSON.stringify(manifest),
    ...(readme ? { ".starciwork/concepts/README.md": "# NIVO concepts\n" } : {}),
    [TOOLS]: "# Tools\n",
    ...docs,
})
const lintRule = { id: "NIVO-NAMES-1", doc: "ext/docs/A.md", lint: { tool: "eslint", file: "tool-ids-from-names.mjs" } }

test("front matter: parsed between the two --- lines, null without one", () => {
    assert.deepEqual(frontMatterOf("---\nrule: A-1\n---\n# t"), { rule: "A-1" })
    assert.equal(frontMatterOf("# no front matter"), null)
    assert.equal(frontMatterOf("---\nrule: A-1\n"), null)
})

test("every cited topic file exists, equal to its lint rule's: no finding", () => {
    const tree = treeOf({
        manifest: { rules: [lintRule], checks: [{ id: "tool-names", run: "ext/checks/tool-names.mjs", why: "w" }] },
        docs: {
            "ext/docs/A.md": doc("rule", "NIVO-NAMES-1", [TOOLS]),
            "ext/docs/checks/tool-names.md": doc("check", "tool-names", [TOOLS]),
        },
    })
    assert.deepEqual(conceptKeys(contextOf(tree)), [])
})

test("a doc citing a topic file that does not exist is a finding", () => {
    const tree = treeOf({
        manifest: { rules: [{ id: "NIVO-X-1", doc: "ext/docs/B.md", hfs: "x.mjs" }], checks: [] },
        docs: { "ext/docs/B.md": doc("rule", "NIVO-X-1", [".starciwork/concepts/noSuchTopic.md"]) },
    })
    const messages = conceptKeys(contextOf(tree)).map((finding) => finding.message)
    assert.ok(messages.some((m) => m.includes("noSuchTopic.md: that concept topic file does not exist")), messages.join("\n"))
})

test("a doc citing nothing, the README, or a non-topic reference is a finding", () => {
    const tree = treeOf({
        manifest: {
            rules: [
                { id: "NIVO-X-1", doc: "ext/docs/B.md", hfs: "x.mjs" },
                { id: "NIVO-X-2", doc: "ext/docs/C.md", hfs: "x.mjs" },
                { id: "NIVO-X-3", doc: "ext/docs/D.md", hfs: "x.mjs" },
            ],
            checks: [{ id: "orphan", run: "ext/checks/orphan.mjs", why: "w" }],
        },
        docs: {
            "ext/docs/B.md": "---\nrule: NIVO-X-1\n---\n# x\n",
            "ext/docs/C.md": doc("rule", "NIVO-X-2", [".starciwork/concepts/README.md"]),
            "ext/docs/D.md": doc("rule", "NIVO-X-3", ["levels-key-not-a-path"]),
        },
    })
    const messages = conceptKeys(contextOf(tree)).map((finding) => finding.message)
    assert.ok(messages.some((m) => m.includes("NIVO-X-1: ext/docs/B.md cites no concept topic file")), messages.join("\n"))
    assert.ok(messages.some((m) => m.includes("README.md: not the path of a concept topic file")), messages.join("\n"))
    assert.ok(messages.some((m) => m.includes("levels-key-not-a-path: not the path")), messages.join("\n"))
    assert.ok(messages.some((m) => m.includes("ext/docs/checks/orphan.md is missing")), messages.join("\n"))
})

test("a doc of another id and a drifted lint rule are findings", () => {
    const tree = treeOf({
        manifest: { rules: [lintRule], checks: [] },
        docs: { "ext/docs/A.md": doc("rule", "NIVO-Y-1", [".starciwork/concepts/templates.md"]), ".starciwork/concepts/templates.md": "# T\n" },
    })
    const messages = conceptKeys(contextOf(tree)).map((finding) => finding.message)
    assert.ok(messages.some((m) => m.includes('names rule "NIVO-Y-1"')), messages.join("\n"))
    assert.ok(messages.some((m) => m.includes("in meta.docs.concept")), messages.join("\n"))
})

test("README missing is a finding", () => {
    const tree = treeOf({ manifest: { rules: [], checks: [] }, readme: false })
    const findings = conceptKeys(contextOf(tree))
    assert.equal(findings.length, 1)
    assert.equal(findings[0].path, ".starciwork/concepts/README.md")
})

test("the real extension: every rule and check cites existing topic files", () => {
    const read = (file) => {
        try {
            return readFileSync(resolve(ROOT, file), "utf8")
        } catch {
            return null
        }
    }
    assert.deepEqual(conceptKeys({ api: 1, repoRoot: ROOT, files: [], read }), [])
})
