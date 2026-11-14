import { readFileSync } from "node:fs"
import { join } from "node:path"
import { manifestOf } from "@nivo-lite/agent-sdk/entity"
import { realInstallation } from "@tests/fixtures/builders/installation-parts.builder"
import { INSTALLED } from "./installed.policy"

/** The entities manifest the harness drift check compares with the database, at the repository root. */
const MANIFEST_FILE = join(__dirname, "..", "..", "..", "..", "..", "db", "entities.manifest.json")

describe("INSTALLED", () => {
    it("hands the entity engine and the planner the entities the installed plugins declare, in the order the registry joined them", () => {
        expect(INSTALLED.entities().map((entity) => entity.name)).toEqual(realInstallation().entities.map((entity) => entity.name))
        // Ledger 2026-11-13: 32 record types (the sales lead's money, the chatbot and the settings; the manifest `db/entities.manifest.json`
        // is the count's source: the second test below keeps the two equal), no longer 43 (the accounting agent's types were dropped).
        expect(INSTALLED.entities()).toHaveLength(32)
    })

    it("gives the same entities manifest as the one the repository holds, so `cli entities check` compares the same declarations", () => {
        const held: unknown = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"))
        expect(manifestOf(INSTALLED.entities())).toEqual(held)
    })

    it("hands the module-jobs runner the jobs the installed plugins declare, in the order the registry joined them", () => {
        expect(INSTALLED.jobs().map((job) => job.name)).toEqual(realInstallation().jobs.map((job) => job.name))
        expect(INSTALLED.jobs().length).toBeGreaterThan(0)
    })
})
