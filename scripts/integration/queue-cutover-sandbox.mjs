// A private, throwaway database that stands at the schema just before the queue cutover, for the cutover integration proof.
//
// The cutover proof must seed pgmq job messages, run the two cutover migrations over them and check nothing was lost; that needs
// a database that has not been migrated yet. Schema-changing SQL and migration text may not live in the test sources (the
// backend lint refuses runtime DDL and raw query text there), so the schema work of the proof is done here and the proof calls
// this script. It never touches the database the integration suites run on: it clones a pristine base database into a sandbox.
//
//   node scripts/integration/queue-cutover-sandbox.mjs create       clone the base, apply every migration before the cutover pair
//   node scripts/integration/queue-cutover-sandbox.mjs apply <file> apply one migration file of db/migrations to the sandbox
//   node scripts/integration/queue-cutover-sandbox.mjs drop         remove the sandbox
//
// Connection: PRIMARY_DB_URL (a local database of the private Supabase stack; any other host is refused).
// Prerequisite: a database named nivo_proof_base on the same server, initialised by Supabase (roles, auth and storage schemas,
// the pg_cron, pgmq and pg_net extensions) with none of this app's migrations. pg_cron can only live in the cron database,
// so a template clone is the one way to get a second database that already carries it.
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import pg from "pg"

const BASE = "nivo_proof_base"
const SANDBOX = "nivo_v037_cutover"
const MIGRATIONS = path.join("db", "migrations")
const CUTOVER_FROM = "20261104235900"
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/** The connection URL of the private stack, refused unless it names a local database. */
const connectionOf = () => {
    const url = new URL(process.env.PRIMARY_DB_URL ?? "")
    if (!LOCAL_HOSTS.has(url.hostname)) throw new Error("The cutover sandbox requires a local database")
    return url
}

/** A connected client on the named database of the private server. */
const clientOn = async (database) => {
    const url = connectionOf()
    url.pathname = `/${database}`
    const client = new pg.Client({ connectionString: url.toString() })
    await client.connect()
    return client
}

/** Runs the work on a client and ends the client whatever happens. */
const using = async (database, work) => {
    const client = await clientOn(database)
    try {
        return await work(client)
    } finally {
        await client.end()
    }
}

/** The migration files in application order. */
const migrationFiles = () =>
    readdirSync(MIGRATIONS)
        .filter((file) => file.endsWith(".sql"))
        .sort()

/** Drops the sandbox, ending any session still open on it. */
const drop = () => using("postgres", (client) => client.query(`DROP DATABASE IF EXISTS ${SANDBOX} WITH (FORCE)`))

/** Applies one migration file in one implicit transaction, the way the Supabase CLI applies it. */
const apply = (file) =>
    using(SANDBOX, (client) => client.query(readFileSync(path.join(MIGRATIONS, path.basename(file)), "utf8")))

/** Clones the pristine base and migrates it to the schema before the cutover pair. */
const create = async () => {
    await drop()
    await using("postgres", async (client) => {
        const base = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [BASE])
        if (base.rowCount === 0)
            throw new Error(`The pristine base database ${BASE} is missing; see the header of this script`)
        await client.query(`CREATE DATABASE ${SANDBOX} TEMPLATE ${BASE}`)
    })
    for (const file of migrationFiles().filter((name) => name < CUTOVER_FROM)) await apply(file)
    process.stdout.write(`${JSON.stringify({ database: SANDBOX })}\n`)
}

const [command, argument] = process.argv.slice(2)
const commands = { create, drop, apply: () => apply(argument ?? "") }
if (!(command in commands)) throw new Error(`Unknown command ${String(command)}`)
await commands[command]()
