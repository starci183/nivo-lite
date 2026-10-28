import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { resolve } from "node:path"
import { promisify } from "node:util"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { WorldSandbox } from "./test-world.contracts"

const exec = promisify(execFile)

/** The app root: one directory above the be side, where the sandbox script lives. */
const APP_ROOT = resolve(__dirname, "..", "..", "..", "..")

/** The script that does the schema work of the sandbox: the test sources hold no schema-changing SQL. */
const SANDBOX_SCRIPT = resolve(APP_ROOT, "scripts", "integration", "queue-cutover-sandbox.mjs")

/** The migration that moves every pgmq job into the outbox (expand), and the one that drops the pgmq functions (contract). */
export const EXPAND_MIGRATION = "20261104235900_queue-cutover.sql"
export const CONTRACT_MIGRATION = "20261105000000_queue-bullmq_contract_pgmq-drop.sql"

/** A sandbox the proof can also migrate step by step. */
export interface CutoverSandbox extends WorldSandbox {
    /** Applies one migration file of db/migrations to the sandbox. */
    readonly apply: (migration: string) => Promise<void>
}

/** Whether the script answered with the sandbox's database name. */
const isCreated = (value: unknown): value is { readonly database: string } =>
    typeof value === "object" && value !== null && "database" in value && typeof value.database === "string"

/** Runs one command of the sandbox script and answers what it printed. */
const run = async (...args: Array<string>): Promise<string> => {
    const { stdout } = await exec(process.execPath, [SANDBOX_SCRIPT, ...args], { cwd: APP_ROOT, env: process.env })
    return stdout
}

/** What the script printed as JSON, or the parse failure itself when it is not JSON (never a created sandbox). */
const parsedOf = (output: string): unknown => {
    try {
        return JSON.parse(output)
    } catch (cause) {
        return { unreadable: cause }
    }
}

/** The private pre-cutover database, cloned from the pristine base and migrated up to the cutover pair by the script. */
export const cutoverSandbox = (): CutoverSandbox => {
    return {
        async create(): Promise<string> {
            const created: unknown = parsedOf(await run("create"))
            assert(isCreated(created), "The sandbox script must name the database it created")
            const url = new URL(parsePrimaryDatabaseConfig(EnvSource.fromProcess()).url.reveal())
            url.pathname = `/${created.database}`
            return url.toString()
        },
        async apply(migration: string): Promise<void> {
            await run("apply", migration)
        },
        async drop(): Promise<void> {
            await run("drop")
        },
    }
}
