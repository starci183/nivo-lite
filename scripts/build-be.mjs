#!/usr/bin/env node
// Builds the back end into be/dist with each app's entry at be/dist/apps/<app>/src/main.js, where `npm run start:api`, `npm run cli`
// and the api and cli images run it. The generated database types live outside be/ (supabase/types), which widens the compiler root:
// tsc writes be/dist/be/... and be/dist/supabase/..., and tsc-alias, which expects be/dist/src/..., would leave the path aliases
// unresolved. The import of the types is type-only, so nothing at run time needs the second tree: the output is flattened first,
// then the aliases are resolved on the flat tree. A stale dist is removed before the build so no deleted module survives in it.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const be = path.join(root, "be")
const dist = path.join(be, "dist")
const BINS = {
    tsc: path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "tsc-alias": path.join(root, "node_modules", "tsc-alias", "dist", "bin", "index.js"),
}
const run = (name, args) => execFileSync(process.execPath, [BINS[name], ...args], { cwd: be, stdio: "inherit" })

fs.rmSync(dist, { recursive: true, force: true })
run("tsc", ["-p", "tsconfig.build.json"])
const nested = path.join(dist, "be")
if (fs.existsSync(nested)) {
    fs.cpSync(nested, dist, { recursive: true })
    fs.rmSync(nested, { recursive: true, force: true })
    fs.rmSync(path.join(dist, "supabase"), { recursive: true, force: true })
}
run("tsc-alias", ["-p", "tsconfig.build.json"])
