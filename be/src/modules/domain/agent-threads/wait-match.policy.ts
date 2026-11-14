import { createHash } from "node:crypto"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { canonicalJson, caseFolded } from "@nivo-lite/agent-sdk/template"
import { eventMemberOf, isRecord, jsonOf, type WaitPark } from "./thread-waits.policy"

/*
 * The lookup keys of a parked wait (`agent_runs.wait_match`, migration 20261114000600_run-wait-match.sql) and the probe of an event
 * against them. The keys only FIND the runs that may take an event, exactly by value, with no page of the agent's runs deciding who is
 * found; `waitTakes` (thread-waits.policy.ts) still decides on the run's own park. So the keys of a park are never narrower than its
 * tests: every run whose wait takes the event holds a key the event's probe names. Pure; no words are read, values are compared whole.
 *
 * Key shapes (the separator is the unit separator, U+001F, which no verb or member name holds):
 *   e <verb> <member> <digest>          a member equal to a value (`eq` tests; the subject members of a trigger with no test)
 *   m <verb> <member> <fold>            a `contains` test on that member exists (the probe names it for every text member)
 *   c <verb> <member> <fold> <part>     the part a `contains` test looks for (read with `strpos` against the event's text)
 *   * <verb>                            a test the keys cannot hold (a part too long to keep): asked for every event of the verb
 */

const SEPARATOR = "\u001f"

/** The longest `contains` part kept as a key; a longer one is held by the catch-all key of its verb. */
const PART_MAX = 500

/** How deep the probe reads an event's records (`data.data.kind` is depth 3). */
const PROBE_DEPTH = 6

const keyOf = (...parts: ReadonlyArray<string>): string => parts.join(SEPARATOR)

/** The digest of a value as the comparison sees it (canonical JSON, so `1` is not `"1"`). */
const digestOf = (value: JsonValue): string => createHash("sha256").update(canonicalJson(value)).digest("hex")

const foldMark = (fold: boolean): string => (fold ? "1" : "0")

/** The catch-all key of a verb. */
const anyOf = (verb: string): string => keyOf("*", verb)

/** The keys of one parked wait: what an event must name (one of) to be asked of this run. */
export const waitMatchKeysOf = (park: WaitPark): ReadonlyArray<string> => {
    const keys = new Set<string>()
    for (const entry of park.on) {
        const tests = entry.match ?? []
        if (tests.length === 0) {
            for (const [member, value] of Object.entries(park.subject)) keys.add(keyOf("e", entry.verb, member, digestOf(value)))
            continue
        }
        for (const test of tests) {
            if (test.op === "eq") {
                keys.add(keyOf("e", entry.verb, test.member, digestOf(test.value)))
                continue
            }
            // A `contains` test holds only of two texts: a part that is no text never takes anything, so it needs no key.
            if (typeof test.value !== "string") continue
            const fold = test.caseFold === true
            const part = fold ? caseFolded(test.value) : test.value
            if (part.length > PART_MAX) {
                keys.add(anyOf(entry.verb))
                continue
            }
            keys.add(keyOf("m", entry.verb, test.member, foldMark(fold)))
            keys.add(keyOf("c", entry.verb, test.member, foldMark(fold), part))
        }
    }
    return [...keys].sort()
}

/** The probe of one event of a verb: the keys it names exactly, the `contains` markers, and its texts by `c` key prefix. */
export interface WaitMatchProbe {
    /** The `e` keys of every member of the event (records and leaves), and the verb's catch-all key. */
    readonly exact: ReadonlyArray<string>
    /** The `m` keys of every text member of the event, both folds. */
    readonly markers: ReadonlyArray<string>
    /** Each text member of the event by its `c` key prefix (`c <verb> <member> <fold> `), folded for the folded prefix. */
    readonly texts: Readonly<Record<string, string>>
}

/** The members of an event as `[path, value]`, records and leaves, read by the same path rule as the tests (`data.content`). */
const membersOf = (record: Readonly<Record<string, unknown>>, prefix: string, depth: number): ReadonlyArray<readonly [string, JsonValue]> =>
    Object.entries(record).flatMap(([name, raw]): ReadonlyArray<readonly [string, JsonValue]> => {
        if (raw === undefined) return []
        const path = prefix === "" ? name : `${prefix}.${name}`
        const value = jsonOf(raw)
        const nested = depth < PROBE_DEPTH && isRecord(raw) ? membersOf(raw, path, depth + 1) : []
        return [[path, value], ...nested]
    })

/** The probe of an event of `verb` against the parked waits' keys. */
export const waitMatchProbeOf = (verb: string, event: Readonly<Record<string, unknown>>): WaitMatchProbe => {
    const exact = new Set<string>([anyOf(verb)])
    const markers = new Set<string>()
    const texts: Record<string, string> = {}
    for (const [path, value] of membersOf(event, "", 1)) {
        // The path rule of the tests reads each member the same way: what the probe names, `eventMemberOf` reads.
        if (eventMemberOf(event, path) === undefined) continue
        exact.add(keyOf("e", verb, path, digestOf(value)))
        if (typeof value !== "string") continue
        for (const fold of [false, true]) {
            markers.add(keyOf("m", verb, path, foldMark(fold)))
            texts[`${keyOf("c", verb, path, foldMark(fold))}${SEPARATOR}`] = fold ? caseFolded(value) : value
        }
    }
    return { exact: [...exact].sort(), markers: [...markers].sort(), texts }
}
