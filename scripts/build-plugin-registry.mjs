// Generates packages/plugin-registry/src/installed.ts and src/client/blocks.ts (the index.ts files re-export them): the one place that names every installed package.
// `node scripts/build-plugin-registry.mjs` writes them; with `--check` it fails when they are out of date.
// The installed packages are the core package (@nivo-lite/blocks-core) and every dependency of the root package.json whose own
// package.json says `"nivo": { "plugin": true }`. A plugin exports its lists from its root entry under the names modules, blocks,
// nodes, jobs and entities (each optional) and, from "./client", the renderers of its blocks as `renderers`.
// The text and the hash lines come from @nivo-lite/agent-sdk/installation (built first: npm run build:modules); this file only reads
// the packages, hashes with node:crypto (the browser bundle holds the literal) and writes.
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import * as prettier from "prettier"

const root = path.resolve(import.meta.dirname, "..")
const require = createRequire(path.join(root, "package.json"))
const registryDir = path.join(root, "packages", "plugin-registry")
const isCheck = process.argv.includes("--check")

const CORE = "@nivo-lite/blocks-core"
const CORE_LISTS = [
    { key: "modules", from: `${CORE}/modules`, name: "MODULE_DECLARATIONS", isRequired: true },
    { key: "blocks", from: CORE, name: "coreBlocks", isRequired: true },
    { key: "nodes", from: CORE, name: "coreNodes", isRequired: true },
    { key: "jobs", from: CORE, name: "coreJobs", isRequired: false },
    { key: "entities", from: CORE, name: "coreEntities", isRequired: false },
]
const PLUGIN_KEYS = ["modules", "blocks", "nodes", "jobs", "entities"]

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"))

/** The package.json of an installed dependency, or null when it is not installed. */
const manifestOf = (name) => {
    const file = path.join(root, "node_modules", ...name.split("/"), "package.json")
    return fs.existsSync(file) ? readJson(file) : null
}

/** The root dependencies whose package.json declares them a plugin, sorted by name. */
const pluginNames = () =>
    Object.keys(readJson(path.join(root, "package.json")).dependencies ?? {})
        .filter((name) => manifestOf(name)?.nivo?.plugin === true)
        .sort()

/** What a package exports: the lists the generator finds, and whether it has a client entry. */
const loadPackage = (lists, renderers) => {
    const present = lists.filter((list) => {
        const isPresent = list.name in require(list.from)
        if (!isPresent && list.isRequired) throw new Error(`${list.from} does not export ${list.name}`)
        return isPresent
    })
    return { lists: present.map(({ key, from, name }) => ({ key, from, name })), renderers }
}

const corePackage = () => loadPackage(CORE_LISTS, { from: `${CORE}/client`, name: "coreBlocks" })

const pluginPackage = (name) =>
    loadPackage(
        PLUGIN_KEYS.map((key) => ({ key, from: name, name: key, isRequired: false })),
        manifestOf(name)?.exports?.["./client"] === undefined ? null : { from: `${name}/client`, name: "renderers" },
    )

const packages = [corePackage(), ...pluginNames().map(pluginPackage)]
const parts = packages.map((entry) =>
    Object.fromEntries(entry.lists.map((list) => [list.key, require(list.from)[list.name]])),
)

const { registryLinesOf, renderClientSource, renderRegistrySource } = require("@nivo-lite/agent-sdk/installation")
const registryHash = createHash("sha256").update(registryLinesOf(parts).join("\n")).digest("hex")

/** The text formatted the way the repository formats TypeScript and JSON. */
const formatted = async (file, text) => {
    const config = (await prettier.resolveConfig(file)) ?? {}
    return prettier.format(text, { ...config, filepath: file })
}

const manifestFile = path.join(registryDir, "package.json")
const manifest = readJson(manifestFile)
const dependencies = Object.fromEntries(
    ["@nivo-lite/agent-sdk", CORE, ...pluginNames()].sort().map((name) => [name, "*"]),
)

const outputs = [
    [path.join(registryDir, "src", "installed.ts"), renderRegistrySource(packages, registryHash)],
    [path.join(registryDir, "src", "client", "blocks.ts"), renderClientSource(packages)],
    [manifestFile, `${JSON.stringify({ ...manifest, dependencies }, null, 2)}\n`],
]

let isStale = false
for (const [file, text] of outputs) {
    const next = await formatted(file, text)
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null
    if (current === next) continue
    isStale = true
    if (!isCheck) {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, next)
    }
    console.log(`${isCheck ? "out of date" : "wrote"} ${path.relative(root, file)}`)
}
if (isCheck && isStale) {
    console.error("The plugin registry is out of date: run node scripts/build-plugin-registry.mjs")
    process.exitCode = 1
}
console.log(`registryHash ${registryHash}`)
