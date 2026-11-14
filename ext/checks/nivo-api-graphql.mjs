#!/usr/bin/env node
// ext/manifest.json check `nivo-api-graphql` (doc ext/docs/checks/nivo-api-graphql.md): every NIVO-owned API name (`API.nivo.*`) maps to exactly
// one GraphQL operation of be/contracts/api/schema.graphql through the declared table NIVO_API_GRAPHQL, and the contract and the table agree.
// No arguments. It BUILDS FIRST (the names are read from the built @nivo-lite/agent-sdk, built alone: it has no workspace dependency and
// another package's broken build must not hide this verdict): a build that fails (another worker's edit in flight) is this check's failure, its
// status passed through. The decisions are
// ext/support/nivo-api-graphql-rules.mjs; the SDL is read by the `graphql` parser.
// Concept: .starciwork/concepts/tools.md (each `nivo.api.nivo.*` op maps 1:1 to one GraphQL operation), .starciwork/concepts/mcp.md.
import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { findingsOf, rootFieldsOf } from "../support/nivo-api-graphql-rules.mjs"
import { ROOT, buildPackage } from "../support/program.mjs"

const SDL = "be/contracts/api/schema.graphql"
const RESOLVERS = "be/src/features/api"

const built = buildPackage("@nivo-lite/agent-sdk")
if (built !== 0) {
    console.error("nivo api graphql: @nivo-lite/agent-sdk does not build, so the names cannot be read (see the build output above)")
    process.exit(built)
}

const require = createRequire(join(ROOT, "package-anchor.js"))
const { NIVO_API, NIVO_API_GRAPHQL } = require(join(ROOT, "packages", "agent-sdk", "dist", "names", "index.js"))
if (NIVO_API === undefined || NIVO_API_GRAPHQL === undefined) {
    console.error("nivo api graphql: @nivo-lite/agent-sdk/names exports no NIVO_API / NIVO_API_GRAPHQL")
    process.exit(1)
}
const names = Object.values(NIVO_API).flatMap((object) => Object.values(object))

/** Every .ts file under `dir` (root-relative paths). */
const tsFilesUnder = (dir) =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? tsFilesUnder(`${dir}/${entry.name}`) : entry.name.endsWith(".ts") ? [`${dir}/${entry.name}`] : [],
    )

const sdl = readFileSync(join(ROOT, SDL), "utf8")
const claims = { [SDL]: sdl }
for (const file of tsFilesUnder(RESOLVERS)) claims[file] = readFileSync(join(ROOT, file), "utf8")

const found = findingsOf({ names, table: NIVO_API_GRAPHQL, roots: rootFieldsOf(sdl), claims })
if (found.length === 0) {
    console.log(`nivo api graphql: ${names.length} NIVO API names map 1:1 to GraphQL operations of ${SDL}`)
} else {
    for (const finding of found) console.error(`nivo api graphql: ${finding}`)
    console.error(`nivo api graphql: ${found.length} finding(s)`)
    process.exitCode = 1
}
