#!/usr/bin/env node
// The generated DDL of the account data types (owner concept tool-naming `accountDataTypes2026_11_12`): one partition of
// `public.account_data` per declared type, a CHECK per declared member (added NOT VALID, then validated) and an expression index per
// declared index, written WHOLE into db/migrations/20261112022900_account-data-types.sql. The declarations are the back end's own
// (`ACCOUNT_DATA_CATALOG` of be/src/modules/domain/account-data-catalog), planned by its DDL-free `accountDataPlanOf`, loaded through
// ts-node like `scripts/seeds-graphs.mjs` (no database, no built files): ALL the SQL text lives here, never in be/src (the lint canon
// refuses DDL outside migrations). The harness db gate does not cover these partitions; this script's --check does.
//
//   npm run account-data:ddl                       writes the migration (the same as --write)
//   npm run account-data:check                     renders in memory, compares with the file byte for byte; exit 1 on any difference
//   node scripts/account-data-ddl.mjs --self-test  one sample plan renders the expected statements
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

/** The generated migration's name; since build TEN's baseline reset its text lives as one part of the baseline (see `currentText`). */
const MIGRATION = "db/migrations/20261112022900_account-data-types.sql"

/** The part header the baseline reset gives each squashed file (`-- ---- from <file> ----`), for this migration. */
const PART = `-- ---- from ${path.basename(MIGRATION)} ----`

/**
 * The committed text of the account data DDL: the migration file while it exists; after the baseline reset (hfs.json `db.baselineReset`),
 * the baseline's part of that file name, up to the next part header. Null when neither holds it.
 */
const currentText = () => {
    if (fs.existsSync(MIGRATION)) return { where: MIGRATION, text: fs.readFileSync(MIGRATION, "utf8") }
    const reset = JSON.parse(fs.readFileSync("hfs.json", "utf8")).db?.baselineReset?.baseline
    if (typeof reset !== "string" || !fs.existsSync(reset)) return null
    const baseline = fs.readFileSync(reset, "utf8").replace(/\r/gu, "")
    const start = baseline.indexOf(`${PART}\n`)
    if (start < 0) return null
    const body = baseline.slice(start + PART.length + 1)
    const next = body.indexOf("\n-- ---- from ")
    return { where: `${reset} (part ${path.basename(MIGRATION)})`, text: next < 0 ? body : body.slice(0, next + 1) }
}

/** The ISO timestamp form a `timestamp` member holds (the entity engine's form). */
const TIMESTAMP = "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$"

/** A whole number as jsonb prints it: no fraction, no exponent, at most the 16 digits of a safe integer. */
const INTEGER = "^-?[0-9]{1,16}$"

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/
const MEMBER = /^[A-Za-z]\w{0,59}$/

const refuse = (what, name) => {
    throw new Error(`account-data-ddl: ${what}: ${name}`)
}

/** A double-quoted identifier; only names of the generated shape are written. */
const quoteIdent = (name) => (IDENT.test(name) ? `"${name}"` : refuse("not a generated identifier", name))

/** A single-quoted literal with quotes doubled. */
const quoteLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`

/** A member name, refused unless it is a plain word. */
const member = (name) => (MEMBER.test(name) ? name : refuse("not a member name", name))

/** The text of a member: `(value->>'name')`. */
const textOf = (name) => `(value->>${quoteLiteral(member(name))})`

/** The test that a present member is of its declared type (text length included). */
const typedCheck = (check) => {
    const key = quoteLiteral(member(check.field))
    const typeIs = (type) => `jsonb_typeof(value->${key}) = ${quoteLiteral(type)}`
    switch (check.fieldType) {
        case "text":
            return check.maxLength === undefined
                ? typeIs("string")
                : `${typeIs("string")} AND char_length(${textOf(check.field)}) <= ${Number(check.maxLength)}`
        case "integer":
            return `${typeIs("number")} AND ${textOf(check.field)} ~ ${quoteLiteral(INTEGER)}`
        case "number":
            return typeIs("number")
        case "boolean":
            return typeIs("boolean")
        case "timestamp":
            return `${typeIs("string")} AND ${textOf(check.field)} ~ ${quoteLiteral(TIMESTAMP)}`
        case "json":
            return `jsonb_typeof(value->${key}) <> 'null'`
        default:
            return refuse("unknown field type", check.fieldType)
    }
}

/** The CHECK of one member: present and of its type when required; absent or of its type when optional. */
const checkSql = (check) =>
    check.required
        ? `${textOf(check.field)} IS NOT NULL AND (${typedCheck(check)})`
        : `${textOf(check.field)} IS NULL OR (${typedCheck(check)})`

/** The indexed expression of a member, cast as its type sorts (time stays ISO text: its cast is not immutable). */
const indexPartOf = (field) => {
    switch (field.fieldType) {
        case "integer":
            return `(${textOf(field.name)}::bigint)`
        case "number":
            return `(${textOf(field.name)}::numeric)`
        case "boolean":
            return `(${textOf(field.name)}::boolean)`
        default:
            return textOf(field.name)
    }
}

/** The statements of one partition, each under its comment line. */
const partitionLines = (entry) => {
    const partition = quoteIdent(entry.partition)
    return [
        `-- create_partition public.${entry.partition}: account_data for values in (${quoteLiteral(entry.type)})`,
        `CREATE TABLE public.${partition} PARTITION OF public.account_data FOR VALUES IN (${quoteLiteral(entry.type)});`,
        ...entry.checks.flatMap((check) => [
            `-- add_check public.${entry.partition}:constraint:${check.name}: added NOT VALID, then validated`,
            `ALTER TABLE public.${partition} ADD CONSTRAINT ${quoteIdent(check.name)} CHECK (${checkSql(check)}) NOT VALID;`,
            `ALTER TABLE public.${partition} VALIDATE CONSTRAINT ${quoteIdent(check.name)};`,
        ]),
        ...entry.indexes.flatMap((index) => [
            `-- create_index public.${entry.partition}:index:${index.name}: on connection_id, ${index.fields.map((field) => field.name).join(", ")} using btree`,
            `CREATE INDEX ${quoteIdent(index.name)} ON public.${partition} USING btree (${["connection_id", ...index.fields.map(indexPartOf)].join(", ")});`,
        ]),
    ]
}

/** The whole migration text of a plan. */
export const renderMigration = (plan) => {
    const header = [
        "-- account-data-types: forward-only; immutable once on origin/main. GENERATED by `npm run account-data:ddl` from the declared account",
        "-- data types (be/src/modules/domain/account-data-catalog, planned by `accountDataPlanOf`); do not edit by hand. Covered by",
        "-- `npm run account-data:check` (the text must equal what the declarations render); NOT covered by the harness db gate.",
        "-- Expand only: one partition of public.account_data per declared type (20261112022700_account-data.sql holds the parent), a CHECK",
        "-- per declared member (added NOT VALID, then validated) and the declared expression indexes. Owner concept tool-naming",
        "-- `accountDataTypes2026_11_12`. No transaction control.",
        "-- Types:",
        ...plan.partitions.map((entry) => `--   ${entry.type}`),
    ]
    const body = plan.partitions.map((entry) => partitionLines(entry).join("\n")).join("\n\n")
    return `${header.join("\n")}\n${body === "" ? "" : `\n${body}\n`}`
}

/** The plan of the declared types, computed by the back end's own source (transpiled only, its path aliases resolved). */
const declaredPlan = () => {
    const BE = path.resolve("be")
    const require = createRequire(path.join(BE, "package-anchor.js"))
    require("reflect-metadata")
    require("ts-node").register({
        project: path.join(BE, "tsconfig.json"),
        transpileOnly: true,
        compilerOptions: { module: "commonjs", moduleResolution: "node10" },
    })
    require("tsconfig-paths").register({ baseUrl: BE, paths: { "@modules/*": ["./src/modules/*"], "@features/*": ["./src/features/*"] } })
    const { ACCOUNT_DATA_CATALOG } = require(path.join(BE, "src", "modules", "domain", "account-data-catalog", "account-data-catalog.ts"))
    const { accountDataPlanOf } = require(path.join(BE, "src", "modules", "domain", "account-data", "account-data-plan.policy.ts"))
    return accountDataPlanOf(ACCOUNT_DATA_CATALOG)
}

/** The first line where two texts differ, as a short hint. */
const diffHint = (want, got) => {
    const wanted = want.split("\n")
    const found = got.split("\n")
    const at = wanted.findIndex((line, index) => line !== found[index])
    const line = at === -1 ? Math.min(wanted.length, found.length) : at
    return `first difference at line ${line + 1}:\n  rendered: ${wanted[line] ?? "(end of text)"}\n  file:     ${found[line] ?? "(end of file)"}`
}

/** One sample plan and the statements it must render. */
const selfTest = () => {
    const plan = {
        partitions: [
            {
                type: "telegram.user",
                partition: "account_data_telegram_user",
                checks: [
                    { name: "account_data_telegram_user_user_id_chk", field: "userId", fieldType: "integer", required: true },
                    { name: "account_data_telegram_user_username_chk", field: "username", fieldType: "text", required: false, maxLength: 64 },
                    { name: "account_data_telegram_user_seen_at_chk", field: "seenAt", fieldType: "timestamp", required: false },
                    { name: "account_data_telegram_user_raw_chk", field: "raw", fieldType: "json", required: true },
                ],
                indexes: [
                    {
                        name: "account_data_telegram_user_username",
                        fields: [
                            { name: "username", fieldType: "text" },
                            { name: "userId", fieldType: "integer" },
                        ],
                    },
                ],
            },
        ],
    }
    const expected = [
        `CREATE TABLE public."account_data_telegram_user" PARTITION OF public.account_data FOR VALUES IN ('telegram.user');`,
        `ALTER TABLE public."account_data_telegram_user" ADD CONSTRAINT "account_data_telegram_user_user_id_chk" CHECK ((value->>'userId') IS NOT NULL AND (jsonb_typeof(value->'userId') = 'number' AND (value->>'userId') ~ '^-?[0-9]{1,16}$')) NOT VALID;`,
        `ALTER TABLE public."account_data_telegram_user" VALIDATE CONSTRAINT "account_data_telegram_user_user_id_chk";`,
        `ALTER TABLE public."account_data_telegram_user" ADD CONSTRAINT "account_data_telegram_user_username_chk" CHECK ((value->>'username') IS NULL OR (jsonb_typeof(value->'username') = 'string' AND char_length((value->>'username')) <= 64)) NOT VALID;`,
        `ALTER TABLE public."account_data_telegram_user" ADD CONSTRAINT "account_data_telegram_user_seen_at_chk" CHECK ((value->>'seenAt') IS NULL OR (jsonb_typeof(value->'seenAt') = 'string' AND (value->>'seenAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;`,
        `ALTER TABLE public."account_data_telegram_user" ADD CONSTRAINT "account_data_telegram_user_raw_chk" CHECK ((value->>'raw') IS NOT NULL AND (jsonb_typeof(value->'raw') <> 'null')) NOT VALID;`,
        `CREATE INDEX "account_data_telegram_user_username" ON public."account_data_telegram_user" USING btree (connection_id, (value->>'username'), ((value->>'userId')::bigint));`,
    ]
    const text = renderMigration(plan)
    const lines = text.split("\n")
    const problems = expected.filter((statement) => !lines.includes(statement)).map((statement) => `self-test: missing ${statement}`)
    const statements = lines.filter((line) => line !== "" && !line.startsWith("--"))
    if (statements.length !== 10) problems.push(`self-test: ${statements.length} statements, want 10`)
    if (!statements.every((line) => line.endsWith(";"))) problems.push("self-test: a statement without its semicolon")
    if (!text.includes("--   telegram.user\n")) problems.push("self-test: the header does not list the type")
    try {
        renderMigration({ partitions: [{ ...plan.partitions[0], checks: [{ ...plan.partitions[0].checks[0], field: "bad'name" }] }] })
        problems.push("self-test: a member name of the wrong shape was rendered")
    } catch {
        // refused, as it must be
    }
    if (renderMigration({ partitions: [] }).includes("CREATE")) problems.push("self-test: an empty plan rendered a statement")
    return problems.length === 0 ? null : problems.join("\n")
}

/** A forward migration of account data types written after the baseline reset (one per batch of NEW types). */
const FORWARD = /^\d{14}_account-data-types-[a-z0-9-]+\.sql$/u

/** The partition blocks of a committed DDL text, by partition name (a block = its `-- create_partition` line up to the next one). */
const blocksOf = (text) => {
    const out = new Map()
    const parts = text.replace(/\r/gu, "").split(/(?=^-- create_partition public\.)/mu)
    for (const part of parts) {
        const name = part.match(/^-- create_partition public\.([a-z0-9_]+):/u)?.[1]
        if (name) out.set(name, part.trimEnd())
    }
    return out
}

/**
 * After the baseline reset the committed account data DDL is the baseline's part plus every forward `<stamp>_account-data-types-<name>.sql`.
 * --check: every declared type has exactly its rendered block there, and no block names an undeclared type. --write: a NEW declared type
 * gets a new forward migration (stamped after every active one) holding only the new types; a CHANGED type is refused (its altering
 * migration is written by hand, expand/contract, BE-PERSISTENCE-19).
 */
const afterReset = (plan) => {
    const held = currentText()
    const forward = fs.readdirSync("db/migrations").filter((f) => FORWARD.test(f)).sort()
    const committed = new Map()
    for (const [where, text] of [[held.where, held.text], ...forward.map((f) => [`db/migrations/${f}`, fs.readFileSync(`db/migrations/${f}`, "utf8")])])
        for (const [name, block] of blocksOf(text)) committed.set(name, committed.has(name) ? { block: null, where: `${committed.get(name).where} AND ${where}` } : { block, where })
    const missing = []
    const problems = []
    for (const entry of plan.partitions) {
        const want = partitionLines(entry).join("\n")
        const got = committed.get(entry.partition)
        if (got === undefined) missing.push(entry)
        else if (got.block === null) problems.push(`${entry.partition}: created twice (${got.where})`)
        else if (got.block !== want) problems.push(`${entry.partition} in ${got.where} differs from its declaration\n${diffHint(want, got.block)}`)
    }
    const declared = new Set(plan.partitions.map((entry) => entry.partition))
    for (const [name, got] of committed) if (!declared.has(name)) problems.push(`${name} in ${got.where} is no declared type`)
    if (process.argv.includes("--check")) {
        if (problems.length === 0 && missing.length === 0) {
            process.stdout.write(`account-data-ddl: ${held.where}${forward.length ? ` + ${forward.length} forward migration(s)` : ""} match the ${plan.partitions.length} declared types\n`)
            return
        }
        for (const entry of missing) problems.push(`${entry.partition} (${entry.type}): declared, no migration creates it (run npm run account-data:ddl)`)
        process.stderr.write(`account-data-ddl: ${problems.join("\n")}\n`)
        process.exit(1)
    }
    if (problems.length > 0) {
        process.stderr.write(`account-data-ddl: refused, a committed type changed (write its altering migration by hand):\n${problems.join("\n")}\n`)
        process.exit(1)
    }
    if (missing.length === 0) {
        process.stdout.write("account-data-ddl: nothing new to write\n")
        return
    }
    const last = fs.readdirSync("db/migrations").filter((f) => /^\d{14}_/u.test(f)).map((f) => f.slice(0, 14)).sort().pop()
    const now = new Date().toISOString().replace(/\D/gu, "").slice(0, 14)
    const next = now > last ? now : String(BigInt(last) + 100n)
    const kinds = [...new Set(missing.map((entry) => entry.type.split(".").pop()))]
    const file = `db/migrations/${next}_account-data-types-${(kinds.length === 1 ? kinds[0] : "batch").replaceAll("_", "-")}.sql`
    fs.writeFileSync(file, renderMigration({ partitions: missing }))
    process.stdout.write(`account-data-ddl: wrote ${file} (${missing.length} new types: ${missing.map((entry) => entry.type).join(", ")})\n`)
}

const main = () => {
    if (process.argv.includes("--self-test")) {
        const failed = selfTest()
        process.stdout.write(failed === null ? "account-data-ddl: self-test PASS\n" : `${failed}\n`)
        process.exit(failed === null ? 0 : 1)
    }
    const failed = selfTest()
    if (failed !== null) {
        process.stderr.write(`${failed}\n`)
        process.exit(1)
    }
    const plan = declaredPlan()
    const text = renderMigration(plan)
    const types = plan.partitions.map((entry) => entry.type).join(", ")
    const held0 = currentText()
    if (held0 !== null && held0.where !== MIGRATION) return afterReset(plan)
    if (process.argv.includes("--check")) {
        const held = held0
        // the baseline reset keeps each part's text whole but trims its trailing blank lines: compare without them
        const current = held === null ? null : held.where === MIGRATION ? held.text : held.text.trimEnd()
        const expected = held !== null && held.where !== MIGRATION ? text.trimEnd() : text
        if (current === expected) {
            process.stdout.write(`account-data-ddl: ${held.where} matches the ${plan.partitions.length} declared types\n`)
            return
        }
        process.stderr.write(
            current === null
                ? `account-data-ddl: ${MIGRATION} is missing and no baseline part holds it (run npm run account-data:ddl)\n`
                : `account-data-ddl: ${held.where} differs from the declarations\n${diffHint(expected, current)}\n`,
        )
        process.exit(1)
    }
    if (!fs.existsSync(MIGRATION) && currentText() !== null) {
        process.stderr.write(
            `account-data-ddl: the account data DDL is part of the reset baseline now; a changed type is a NEW migration stamped after it (starci app db new), not a rewrite\n`,
        )
        process.exit(1)
    }
    fs.writeFileSync(MIGRATION, text)
    process.stdout.write(`account-data-ddl: wrote ${MIGRATION} (${plan.partitions.length} types: ${types})\n`)
}

main()
