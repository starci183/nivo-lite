import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** The world state protocol the jest preset's world runner reads (state protocol 2 of @starci/test-world). */
const WORLD_STATE_VERSION = 2

/** The variable through which the world runner finds the state file of this run. */
const STATE_FILE_ENV = "STARCI_TEST_WORLD_STATE"

/** The local development database `npm run db:create` makes (the admin role of a throwaway container on a loopback port). */
const LOCAL_DATABASE_URL = "postgresql://postgres@127.0.0.1:54322/postgres"

/**
 * The lite world: `npm run db:create` and `db:start` own the local database, `db:push` its migrations, and each suite world owns
 * its connections. The setup points the suites at that database (unless the caller named a local database already) and publishes it to the world
 * runner as the one data slot of the run (a state file, protocol 2), so the runner runs the integration files one by one, each in a
 * process of its own. The teardown removes the file.
 */
export default function lifecycle(): Promise<void> {
    if ((process.env.PRIMARY_DB_URL ?? "") === "") {
        process.env.PRIMARY_DB_URL = LOCAL_DATABASE_URL
        process.env.PRIMARY_DB_SCHEMA = "public"
    }
    const file = join(mkdtempSync(join(tmpdir(), "nivo-lite-world-")), "state.json")
    const state = {
        version: WORLD_STATE_VERSION,
        library: "nivo-lite local database world",
        slots: [{ slot: 1, stack: "local development database" }],
    }
    writeFileSync(file, JSON.stringify(state))
    process.env[STATE_FILE_ENV] = file
    return Promise.resolve()
}
