#!/usr/bin/env node
// The guard of the tool-name flips (2026-11-12: the `nivo.` prefix, one purpose = one tool, then the three levels `nivo.api | tool |
// trigger`): no OLD tool id is written anywhere in the repository outside the places that keep history (migrations, decision records)
// and the map. There is no alias: an old name resolves to nothing, so an old name left in code, a template, a seed, a baseline or a doc
// is a bug. Three sources of "old":
//   1. the first flip's ids (listed below) and the retired wildcards;
//   2. every OLD key of scripts/tool-rename-20261112.json `tools` (a key that is not also a value), never retyped here;
//   3. the LAW of a NIVO verb (`nivo.<level>.<1-4 segments>`, level `api | tool | trigger`, as `isToolId` of @nivo-lite/agent-sdk/schema):
//      a whole quoted literal shaped like a NIVO id (`"nivo.<a>.<b>..."`) that does not obey it is retired, whether the map knows it or
//      not (`"nivo.payment.peek"`). A grammar check of the id's shape, never of its words.
//
//   npm run tool-names:check            exit 0 = clean; exit 1 = old ids found (each `file:line id`)
//   node scripts/tool-names-check.mjs --self-test   the matcher, and the map (no id both old and new, every new id obeys the law and
//                                                   fits the grant CHECK, every trigger verb obeys the law, constants one-to-one)
//
// A source check, not a spec: the lint canon refuses a spec that reads source (starci-be/spec-no-source-read). It reads every file git
// tracks or would track, plus every single IGNORED file outside an ignored folder (a template named `report*.json` hides under the
// managed ignore block and is still read by the build). In JS/TS only string literals, template text and comments count, so a member
// read such as `dossier.status` is no tool id.
import { spawnSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { extname, join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** The ONE old -> new table of the 2026-11-12 renames: exact tool pairs, constant names, trigger kinds -> verbs. */
const RENAME_MAP_FILE = "scripts/tool-rename-20261112.json"
const RENAME_MAP = JSON.parse(readFileSync(join(ROOT, RENAME_MAP_FILE), "utf8"))

/** Every old id the first flip (20261112014200) retired, as it was written. */
const FIRST_FLIP_IDS = [
    "customer.message.send", "customer.care.schedule", "customer.care.send", "lead.ensure", "lead.update", "lead.stage.update",
    "order.create", "order.confirm", "order.cancel", "payment.qr.create", "payment.order.settle", "payment.credit.rematch",
    "payment.claim.record", "payment.claim.cancel", "payment.instruction", "team.message.post", "agent.tag", "work.item.create",
    "work.item.cancel", "report.daily.close", "ledger.append", "ledger.void", "ledger.status", "bank.transactions", "brain.search",
    "brain.facts.list", "brain.facts.get", "brain.documents.read", "brain.fact.related", "brain.change.propose",
    "sepay.transactions.list", "sepay.transactions.debits", "sepay.status", "zalo.status", "telegram.status", "drive.status",
    "drive.sources.list", "dossier.status", "dossier.findings.list", "einvoice.list", "einvoice.get", "chat.send", "chat.profile",
    "team-chat.post-report", "team-chat.post-approval",
]

/** The ids of the map that are OLD: a key of `tools` that is not also a value of it. */
const MAP_OLD_IDS = (() => {
    const news = new Set(Object.values(RENAME_MAP.tools))
    return Object.keys(RENAME_MAP.tools).filter((id) => !news.has(id))
})()

/** Every old id a flip retired by name: the first flip's list and the old ids of the map. */
const OLD_IDS = [...new Set([...FIRST_FLIP_IDS, ...MAP_OLD_IDS])]

/** The old wildcard grants, judged only as a whole quoted literal (prose `lead.*` is a graph ref): the first flip's and the map's. */
const OLD_WILDCARDS = [
    ...new Set([
        "ledger.*", "bank.*", "brain.*", "drive.*", "dossier.*", "einvoice.*", "chat.*", "team-chat.*", "customer.*", "order.*",
        "payment.*", "team.*", "work.*", "report.*", "nivo-web.*", "sepay.*", "zalo.*", "telegram.*", "google.*", "google.drive.*",
    ]),
]

/** The tool namespaces the second flip retired: any `<namespace>.<a>.<b>` or `<namespace>.*` is an old tool id (`nivo-web.x.y`). */
const OLD_NAMESPACES = ["nivo-web"]

/** Paths that keep history or belong to another chat; the map itself; and this check. */
const ALLOWED = ["db/migrations/", ".starciwork/", RENAME_MAP_FILE, "scripts/tool-names-check.mjs"]

const SKIP = [
    /(^|\/)node_modules\//u, /(^|\/)dist([.\w-]*)?\//u, /(^|\/)\.next\//u, /(^|\/)\.turbo\//u, /(^|\/)coverage\//u,
    /(^|\/)__generated__\//u, /^gallery\/capture/u, /(^|\/)package-lock\.json$/u,
]
const CODE = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".cts"])
const TEXT = new Set([".json", ".yaml", ".yml", ".md", ".sql", ".txt", ".graphql", ".gql", ".html", ".csv"])
const MAX_BYTES = 4 * 1024 * 1024

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
const alternation = (ids) => [...ids].sort((a, b) => b.length - a.length).map(escaped).join("|")

/** An old id as a whole token: not inside a longer id (`nivo.lead.update`, `lead.updated`, `sepay.status.get`). */
const ID_TOKEN = new RegExp(`(?<![A-Za-z0-9_.\\-/@$])(${alternation(OLD_IDS)})(?![A-Za-z0-9_\\-*]|\\.[A-Za-z0-9_*])`, "gu")
/** The wire names of the agent loop (`.` → `__`) of the old ids. */
const WIRE_TOKEN = new RegExp(`(?<![A-Za-z0-9_])(${alternation(OLD_IDS.map((id) => id.replaceAll(".", "__")))})(?![A-Za-z0-9_])`, "gu")
/** An old wildcard as a whole quoted literal. */
const WILDCARD_LITERAL = new RegExp(`(["'\`])(${alternation(OLD_WILDCARDS)})\\1`, "gu")
/** A tool id of a retired namespace: the namespace, then `*` or at least two segments (`nivo-web.json` is a file name, not an id). */
const NAMESPACE_TOKEN = new RegExp(
    `(?<![A-Za-z0-9_.\\-/@$])((?:${alternation(OLD_NAMESPACES)})\\.(?:\\*|[a-z][a-z0-9-]*(?:\\.[a-z][a-z0-9-]*)+))(?![A-Za-z0-9_\\-*])`,
    "gu",
)

/** The law of a NIVO verb (`isToolId` / `isTriggerVerb` / `isApiVerb` of @nivo-lite/agent-sdk/schema). */
const NIVO_VERB = /^nivo\.(api|tool|trigger)(\.[a-z][a-z0-9-]*){1,4}$/u
/**
 * The law of a CRM operation (`isCrmOp` of @nivo-lite/agent-sdk/schema, owner chốt 2026-11-13): `nivo.api.crm.<crmId>.<method>.<path>`,
 * generated from a pinned OpenAPI document, its path up to 12 segments; the one `nivo.api.*` form past four segments.
 */
const CRM_OP = /^nivo\.api\.crm\.[a-z][a-z0-9-]{1,30}\.(get|post|put|patch|delete)(\.[a-z][a-z0-9-]*){0,12}$/u
/** The law of a NIVO tool id alone. */
const NIVO_TOOL = /^nivo\.tool(\.[a-z][a-z0-9-]*){1,4}$/u
/** The law of a NIVO trigger verb alone. */
const NIVO_TRIGGER = /^nivo\.trigger(\.[a-z][a-z0-9-]*){1,4}$/u
/** A whole quoted literal shaped like a NIVO id: `nivo.` and at least two more kebab-case segments. */
const NIVO_SHAPED_LITERAL = /(["'`])(nivo(?:\.[a-z][a-z0-9-]*){2,})\1/gu

const gitFiles = (args) => {
    const run = spawnSync("git", ["-C", ROOT, "ls-files", ...args, "-z"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    if (run.status !== 0) throw new Error(`git ls-files failed: ${run.stderr}`)
    return run.stdout.split("\0").filter((file) => file !== "")
}

const repositoryFiles = () => {
    const ignored = gitFiles(["-o", "-i", "--exclude-standard", "--directory"]).filter((file) => !file.endsWith("/"))
    return [...gitFiles(["-co", "--exclude-standard"]), ...ignored]
        .map((file) => file.replaceAll("\\", "/"))
        .filter((file) => !SKIP.some((pattern) => pattern.test(file)))
        .filter((file) => !ALLOWED.some((prefix) => file.startsWith(prefix)))
        .filter((file) => CODE.has(extname(file)) || TEXT.has(extname(file)))
}

const readable = (file) => {
    const path = join(ROOT, file)
    try {
        return statSync(path).size > MAX_BYTES ? null : readFileSync(path, "utf8")
    } catch {
        return null
    }
}

/** The spans [start, end) of string literals, template text and comments of JS/TS source (strings, templates, comments, regexes). */
const literalSpans = (source) => {
    const spans = []
    const templates = []
    let depth = 0
    let at = 0
    let last = ""
    const template = (from) => {
        let index = from
        while (index < source.length) {
            const char = source[index]
            if (char === "\\") index += 2
            else if (char === "`") {
                spans.push([from, index])
                return { next: index + 1, open: false }
            } else if (char === "$" && source[index + 1] === "{") {
                spans.push([from, index])
                return { next: index + 2, open: true }
            } else index++
        }
        spans.push([from, source.length])
        return { next: source.length, open: false }
    }
    while (at < source.length) {
        const char = source[at]
        const next = source[at + 1]
        if (char === "/" && next === "/") {
            const end = source.indexOf("\n", at)
            const stop = end === -1 ? source.length : end
            spans.push([at + 2, stop])
            at = stop
        } else if (char === "/" && next === "*") {
            const end = source.indexOf("*/", at + 2)
            const stop = end === -1 ? source.length : end
            spans.push([at + 2, stop])
            at = stop + 2
        } else if (char === '"' || char === "'") {
            let index = at + 1
            while (index < source.length && source[index] !== char && source[index] !== "\n") index += source[index] === "\\" ? 2 : 1
            spans.push([at + 1, Math.min(index, source.length)])
            at = index + 1
            last = char
        } else if (char === "`") {
            const moved = template(at + 1)
            if (moved.open) {
                templates.push(depth)
                depth = 0
            }
            at = moved.next
            last = "`"
        } else if (char === "{") {
            depth++
            at++
            last = char
        } else if (char === "}" && templates.length > 0 && depth === 0) {
            depth = templates.pop()
            const moved = template(at + 1)
            if (moved.open) {
                templates.push(depth)
                depth = 0
            }
            at = moved.next
            last = "`"
        } else if (char === "/" && (last === "" || "(,=:[!&|?{};+-*%<>~^".includes(last))) {
            let index = at + 1
            let inClass = false
            while (index < source.length && source[index] !== "\n") {
                const inner = source[index]
                if (inner === "\\") index++
                else if (inner === "[") inClass = true
                else if (inner === "]") inClass = false
                else if (inner === "/" && !inClass) break
                index++
            }
            at = index + 1
            last = ")"
        } else {
            if (char === "}") depth--
            if (!/\s/u.test(char)) last = /[A-Za-z0-9_$]/u.test(char) ? "a" : char
            at++
        }
    }
    return spans
}

const insideAny = (spans, index) => spans.some(([start, end]) => index >= start && index < end)

/** Where an old id is still written in one file: `file:line id`. */
export const oldIdsIn = (file, text) => {
    const spans = CODE.has(extname(file)) ? literalSpans(text) : null
    const found = []
    const seen = new Set()
    const lineOf = (index) => text.slice(0, index).split("\n").length
    for (const pattern of [ID_TOKEN, WIRE_TOKEN, NAMESPACE_TOKEN]) {
        for (const match of text.matchAll(pattern)) {
            const id = match[1]
            if (seen.has(match.index)) continue
            if (text[match.index + id.length] === "(") continue
            if (spans !== null && !insideAny(spans, match.index)) continue
            seen.add(match.index)
            found.push(`${file}:${lineOf(match.index)} ${id}`)
        }
    }
    for (const match of text.matchAll(WILDCARD_LITERAL)) {
        if (seen.has(match.index + 1)) continue
        found.push(`${file}:${lineOf(match.index)} ${match[2]}`)
    }
    for (const match of text.matchAll(NIVO_SHAPED_LITERAL)) {
        const at = match.index + 1
        if (seen.has(at) || NIVO_VERB.test(match[2]) || CRM_OP.test(match[2])) continue
        if (spans !== null && !insideAny(spans, at)) continue
        seen.add(at)
        found.push(`${file}:${lineOf(match.index)} ${match[2]}`)
    }
    return found
}

/** The CHECK of public.mcp_tool_grants.tool (20261112014201): every new id must fit it (dashes in the last segment included). */
const GRANT_CHECK = /^[a-z][a-z0-9-]{1,30}\.(([a-z][a-z0-9-]*\.)*[a-zA-Z][a-zA-Z0-9_-]*|([a-z][a-z0-9-]*\.)*\*)$/u

/** Why the map disagrees with itself or with the law, one text each; empty when it agrees. */
const mapProblems = () => {
    const problems = []
    const tools = RENAME_MAP.tools
    const news = new Set(Object.values(tools))
    for (const id of Object.keys(tools)) if (news.has(id)) problems.push(`map: ${id} is both an old and a new id`)
    for (const id of news) {
        if (!GRANT_CHECK.test(id) || id.length > 120) problems.push(`map: new id ${id} does not fit the grant CHECK`)
        if (!NIVO_TOOL.test(id)) problems.push(`map: new id ${id} does not obey the law of a nivo.tool.* id`)
    }
    for (const [kind, verb] of Object.entries(RENAME_MAP.triggers ?? {})) {
        if (!NIVO_TRIGGER.test(verb)) problems.push(`map: trigger ${kind} -> ${verb} does not obey the law of a nivo.trigger.* verb`)
    }
    const constants = Object.entries(RENAME_MAP.constants ?? {})
    const renamed = new Set(constants.map(([, name]) => name))
    for (const [old, name] of constants) {
        if (old === name || renamed.has(old)) problems.push(`map: constant ${old} -> ${name} is no rename`)
    }
    for (const section of ["wildcards", "connectors"]) {
        if (section in RENAME_MAP) problems.push(`map: section ${section} is withdrawn (the stored data is re-seeded)`)
    }
    return problems
}

const selfTest = () => {
    const source = [
        'const a = "customer.message.send"',
        "// calls ledger.append once",
        "const b = `team-chat.post-report`",
        'const wire = "brain__search"',
        'const grant = "brain.*"',
        'const kept = ["nivo.tool.lead.update", "nivo.tool.connection.status.get", "lead.updated", "team-chat.send", "nivo.tool.crm.get.tickets-id"]',
        "if (dossier.status === 1) chat.send(x)",
        'const c = ["sepay.status.get", "nivo-web.ticket.get", "nivo-web.ticket.later.op", "sepay.*"]',
        'const d = { file: "nivo-web.json", pkg: "@starci/nivo-web-core", wire: "zalo__status__get" }',
        'const e = ["nivo.lead.update", "nivo.payment.peek", "nivo.api.crm.get.tickets-id", "nivo.trigger.clock.tick", "nivo.json"]',
        'const f = ["nivo.tool.a.b.c.d.e", "nivo.tool", "nivo.trigger.lead.message.received", "nivo.tool.crm.customer.contact.update"]',
        'const g = ["nivo.api.crm.nivoweb.post.purchases.id.acceptance", "nivo.api.crm.nivoweb.get"]',
    ].join("\n")
    const got = [...oldIdsIn("x.ts", source)].sort().join("|")
    const want = [
        "x.ts:1 customer.message.send",
        "x.ts:2 ledger.append",
        "x.ts:3 team-chat.post-report",
        "x.ts:4 brain__search",
        "x.ts:5 brain.*",
        "x.ts:8 sepay.status.get",
        "x.ts:8 nivo-web.ticket.get",
        "x.ts:9 zalo__status__get",
        "x.ts:8 nivo-web.ticket.later.op",
        "x.ts:8 sepay.*",
        "x.ts:10 nivo.lead.update",
        "x.ts:10 nivo.payment.peek",
        "x.ts:11 nivo.tool.a.b.c.d.e",
    ].sort().join("|")
    const problems = mapProblems()
    if (got !== want) problems.push(`self-test: got ${got}`)
    return problems.length === 0 ? null : problems.join("\n")
}

const main = () => {
    if (process.argv.includes("--self-test")) {
        const failed = selfTest()
        process.stdout.write(failed === null ? "tool-names-check: self-test PASS\n" : `${failed}\n`)
        process.exit(failed === null ? 0 : 1)
    }
    const failed = selfTest()
    if (failed !== null) {
        process.stderr.write(`${failed}\n`)
        process.exit(1)
    }
    const files = repositoryFiles()
    const left = files.flatMap((file) => {
        const text = readable(file)
        return text === null ? [] : oldIdsIn(file, text)
    })
    if (left.length === 0) {
        process.stdout.write(`tool-names-check: PASS (${files.length} files, no old tool id)\n`)
        process.exit(0)
    }
    process.stdout.write(`tool-names-check: FAIL, ${left.length} old tool ids:\n${left.join("\n")}\n`)
    process.exit(1)
}

main()
