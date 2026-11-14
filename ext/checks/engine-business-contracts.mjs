#!/usr/bin/env node
// ext/manifest.json check `engine-business-contracts` (doc ext/docs/checks/engine-business-contracts.md): the engine names no service contract of one
// module's business, and a provider module imports no piece that holds state about people or conversations. Three parts, all decided from what the code
// declares and calls (ext/support/engine-business-contracts-rules.mjs): (A) agent-sdk declares, and the engine references, only the contracts listed as
// generic in .starciwork/concepts/layers.md; (B) a domain module that exists only around such a contract is named; (C) the provider modules (those that
// register themselves in a registry at boot) import, among the domain pieces, only the set written in .starciwork/concepts/providers.md; (D) the one event
// pipeline (.starciwork/concepts/triggers.md rule 13 and its three tables): a provider trigger declaration (a file declaring `translate`) is pure, only the
// one delivery function and the listed engine callers import the wake writers, and the trigger scope declares only the generic members. No build, no
// arguments; one line per finding, then the counts; exit 1 on any finding.
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
    allowedProviderImports,
    aroundContract,
    contractFindings,
    deliveryFindings,
    findingLine,
    genericContracts,
    pipelineFindingLine,
    pipelineLists,
    providerFindingLine,
    providerImportFindings,
    providerModules,
    scopeFindings,
    translateFindings,
    treeOf,
} from "../support/engine-business-contracts-rules.mjs"
import { ROOT } from "../support/program.mjs"

const SCOPE = ["be", "packages/agent-sdk/src"]
const gitList = (args) =>
    spawnSync("git", ["ls-files", "-z", ...args, "--", ...SCOPE], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
        .stdout.split("\0")
        .filter((file) => file !== "")
// Tracked files and the untracked ones git does not ignore (a lane is uncommitted); a file git lists but that is gone is skipped.
const paths = [...new Set([...gitList([]), ...gitList(["--others", "--exclude-standard"])])].sort()
const files = new Map()
for (const path of paths) {
    if (!/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(path)) continue
    try {
        files.set(path, readFileSync(resolve(ROOT, path), "utf8"))
    } catch {
        // gone since git listed it
    }
}

const concept = (name) => readFileSync(resolve(ROOT, ".starciwork", "concepts", name), "utf8")
const generic = genericContracts(concept("layers.md"))
const allowed = allowedProviderImports(concept("providers.md"))
const pipeline = pipelineLists(concept("triggers.md"))
const listErrors = [...generic.errors, ...allowed.errors, ...pipeline.errors]
if (listErrors.length > 0) {
    for (const error of listErrors) console.error(`engine business contracts: ${error}`)
    process.exit(1)
}

const tree = treeOf(files)
const { findings, declared } = contractFindings(tree, generic.ids)
const counted = findings.filter((finding) => !finding.kind.startsWith("test-support"))
const testSupport = findings.filter((finding) => finding.kind.startsWith("test-support"))
const around = aroundContract(tree, counted.filter((finding) => finding.kind === "engine-reference"))
const providers = providerModules(tree)
const providerFindings = providerImportFindings(tree, providers, allowed.allowed)
const pipelineFindings = [
    ...translateFindings(tree, pipeline.schema),
    ...deliveryFindings(tree, pipeline.writers, pipeline.callers),
    ...scopeFindings(tree, pipeline.scopeFiles, pipeline.scope),
]

for (const finding of counted) console.error(findingLine(finding))
for (const one of around)
    console.error(`be/src/modules/domain/${one.folder}  domain module ${one.folder} exists only around contract ${one.contracts.join(", ")} (all ${one.files.length} service file(s) reference it or import a file that does)`)
for (const finding of providerFindings) console.error(providerFindingLine(finding))
for (const finding of pipelineFindings) console.error(pipelineFindingLine(finding))

const counts = (rows, key) => {
    const found = {}
    for (const row of rows) found[key(row)] = (found[key(row)] ?? 0) + 1
    return Object.entries(found)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => `${name} ${count}`)
        .join(", ")
}
console.log(
    `engine business contracts: ${declared.length} contract declaration(s), ${generic.ids.size} generic [${[...generic.ids].join(", ")}]; ` +
        `providers: ${[...providers.keys()].sort().join(", ")}`,
)
if (testSupport.length > 0) console.log(`engine business contracts: ${testSupport.length} reference(s) in be/src/tests support files, not counted (${counts(testSupport, (row) => row.contract)})`)
const total = counted.length + around.length + providerFindings.length + pipelineFindings.length
console.log(
    `engine business contracts: ${total} finding(s): ${counts(counted, (row) => row.kind) || "no contract finding"}; ${around.length} domain module(s) only around a contract; ` +
        `${providerFindings.length} provider import(s) outside the allowed set${providerFindings.length === 0 ? "" : ` (${counts(providerFindings, (row) => row.folder)})`}; ` +
        `${pipelineFindings.length} event pipeline finding(s)${pipelineFindings.length === 0 ? "" : ` (${counts(pipelineFindings, (row) => row.part)})`}`,
)
process.exit(total > 0 ? 1 : 0)
