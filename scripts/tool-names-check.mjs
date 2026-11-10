#!/usr/bin/env node
// The guard of the tool-name flip (2026-11-12): no OLD tool id is written anywhere in the repository outside the places that keep
// history (applied migrations, decision records) and the web app (flipped by its own chat). There is no alias: an old name resolves to
// nothing, so an old name left in code, a template, a seed, a baseline or a doc is a bug.
//
//   npm run tool-names:check            exit 0 = clean; exit 1 = old ids found (each `file:line id`)
//   node scripts/tool-names-check.mjs --self-test
//
// A source check, not a spec: the lint canon refuses a spec that reads source (starci-be/spec-no-source-read). It reads every file git
// tracks or would track, plus every single IGNORED file outside an ignored folder (a template named `report*.json` hides under the
// managed ignore block and is still read by the build). In JS/TS only string literals, template text and comments count, so a member
// read such as `dossier.status` is no tool id.
import { spawnSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { extname, join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

/** Every old id the flip retired, as it was written. */
const OLD_IDS = [
    "customer.message.send", "customer.care.schedule", "customer.care.send", "lead.ensure", "lead.update", "lead.stage.update",
    "order.create", "order.confirm", "order.cancel", "payment.qr.create", "payment.order.settle", "payment.credit.rematch",
    "payment.claim.record", "payment.claim.cancel", "payment.instruction", "team.message.post", "agent.tag", "work.item.create",
    "work.item.cancel", "report.daily.close", "ledger.append", "ledger.void", "ledger.status", "bank.transactions", "brain.search",
    "brain.facts.list", "brain.facts.get", "brain.documents.read", "brain.fact.related", "brain.change.propose",
    "sepay.transactions.list", "sepay.transactions.debits", "sepay.status", "zalo.status", "telegram.status", "drive.status",
    "drive.sources.list", "dossier.status", "dossier.findings.list", "einvoice.list", "einvoice.get", "chat.send", "chat.profile",
    "team-chat.post-report", "team-chat.post-approval",
]

/** The old wildcard grants, judged only as a whole quoted literal (prose `lead.*` is a graph ref). */
const OLD_WILDCARDS = [
    "ledger.*", "bank.*", "brain.*", "drive.*", "dossier.*", "einvoice.*", "chat.*", "team-chat.*", "customer.*", "order.*",
    "payment.*", "team.*", "work.*", "report.*",
]

/** Paths that keep history or belong to another chat; and this check. */
const ALLOWED = ["db/migrations/", ".starciwork/", "fe/", "scripts/tool-names-check.mjs"]

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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

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
    const lineOf = (index) => text.slice(0, index).split("\n").length
    for (const pattern of [ID_TOKEN, WIRE_TOKEN]) {
        for (const match of text.matchAll(pattern)) {
            const id = match[1]
            if (text[match.index + id.length] === "(") continue
            if (spans !== null && !insideAny(spans, match.index)) continue
            found.push(`${file}:${lineOf(match.index)} ${id}`)
        }
    }
    for (const match of text.matchAll(WILDCARD_LITERAL)) found.push(`${file}:${lineOf(match.index)} ${match[2]}`)
    return found
}

const selfTest = () => {
    const source = [
        'const a = "customer.message.send"',
        "// calls ledger.append once",
        "const b = `team-chat.post-report`",
        'const wire = "brain__search"',
        'const grant = "brain.*"',
        'const kept = ["nivo.lead.update", "sepay.status.get", "lead.updated", "team-chat.send"]',
        "if (dossier.status === 1) chat.send(x)",
    ].join("\n")
    const got = oldIdsIn("x.ts", source).join("|")
    const want = "x.ts:1 customer.message.send|x.ts:2 ledger.append|x.ts:3 team-chat.post-report|x.ts:4 brain__search|x.ts:5 brain.*"
    return got === want ? null : `self-test: got ${got}`
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
