import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

/** The world state protocol the jest preset's world runner reads (state protocol 2 of @starci/test-world). */
const WORLD_STATE_VERSION = 2

/** The variable through which the world runner finds the state file of this run. */
const STATE_FILE_ENV = "STARCI_TEST_WORLD_STATE"

/** The local stack's database connection as the Supabase CLI reports it. */
interface LocalStackStatus {
    readonly DB_URL: string
}

/** The app root: one directory above the be side, where the Supabase CLI keeps the stack's config. */
const APP_ROOT = resolve(__dirname, "..", "..", "..", "..")

/** Whether the CLI's answer names the local database. */
const isStackStatus = (value: unknown): value is LocalStackStatus =>
    typeof value === "object" && value !== null && "DB_URL" in value && typeof value.DB_URL === "string"

/** The CLI's answer as JSON, or the parse failure itself when it is not JSON (never a stack status). */
const parsedOf = (output: string): unknown => {
    try {
        return JSON.parse(output)
    } catch (cause) {
        return { unreadable: cause }
    }
}

/**
 * The connection of the local Supabase CLI stack, read from the app's own CLI (no lookup through the PATH); empty when the CLI did
 * not report one, and the suites then refuse to open their world.
 */
const localDatabaseUrl = (): string => {
    const cli = createRequire(join(APP_ROOT, "package.json")).resolve("supabase/dist/supabase.js")
    const output = execFileSync(process.execPath, [cli, "status", "--output", "json"], {
        cwd: APP_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
    })
    const status = parsedOf(output)
    return isStackStatus(status) ? status.DB_URL : ""
}

/**
 * The lite world: the Supabase CLI owns the local stack, its startup and its migrations, and each suite world owns its connections.
 * The setup points the suites at that stack (unless the caller named a local database already) and publishes it to the world
 * runner as the one data slot of the run (a state file, protocol 2), so the runner runs the integration files one by one, each in a
 * process of its own. The teardown removes the file.
 */
export default function lifecycle(): Promise<void> {
    if ((process.env.PRIMARY_DB_URL ?? "") === "") {
        process.env.PRIMARY_DB_URL = localDatabaseUrl()
        process.env.PRIMARY_DB_SCHEMA = "public"
    }
    const file = join(mkdtempSync(join(tmpdir(), "nivo-lite-world-")), "state.json")
    const state = {
        version: WORLD_STATE_VERSION,
        library: "nivo-lite local Supabase world",
        slots: [{ slot: 1, stack: "local Supabase CLI stack" }],
    }
    writeFileSync(file, JSON.stringify(state))
    process.env[STATE_FILE_ENV] = file
    return Promise.resolve()
}
