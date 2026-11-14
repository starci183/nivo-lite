// Generates `src/crm/<id>/api.generated.ts` from every pinned `src/crm/<id>/openapi.json` (the ONE derivation lives in
// `@nivo-lite/agent-sdk/names`). `--check` writes nothing and exits 1 when a generated file differs from what the document gives.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { crmNamesTextOf, crmOpsOf } from "@nivo-lite/agent-sdk/names"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "crm")
const check = process.argv.includes("--check")
let failed = false

for (const id of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const documentPath = path.join(root, id, "openapi.json")
    if (!existsSync(documentPath)) continue
    const reading = crmOpsOf(JSON.parse(readFileSync(documentPath, "utf8")), id)
    if (!reading.ok) {
        console.error(`crm-codegen: ${id}: ${reading.problem}${reading.at === null ? "" : ` at ${reading.at}`}`)
        failed = true
        continue
    }
    const text = crmNamesTextOf(id, reading.basePath, reading.entries)
    const target = path.join(root, id, "api.generated.ts")
    const current = existsSync(target) ? readFileSync(target, "utf8") : null
    if (check) {
        if (current !== text) {
            console.error(`crm-codegen: ${id}: api.generated.ts is out of date (run npm run crm:codegen)`)
            failed = true
        }
    } else if (current !== text) {
        writeFileSync(target, text)
        console.log(`crm-codegen: ${id}: wrote api.generated.ts (${reading.entries.length} operations)`)
    }
}
process.exit(failed ? 1 : 0)
