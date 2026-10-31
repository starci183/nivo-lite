import type { ModuleDefinition } from "../modules.contracts"
import { vndOf } from "./setup-writes.policy"
import type { ProposedBranch } from "./setup-writes.policy"

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const clean = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

/** The most branch cards one turn may propose. */
const BRANCHES_PER_TURN = 3

/** The band an amount on the line belongs to, as the model read it from the owner. */
const belongsOf = (value: unknown): "lower" | "higher" | null => {
    if (value === "lower" || value === "higher") return value
    return null
}

/**
 * The branch cards of a turn: an action of the module with an amount limit, the amount where its bands meet, and the person asked
 * above the line, each with the words of the owner. The model never invents an action: one the module does not govern is dropped, and
 * so is a card with no amount or no person. Which band the amount itself belongs to may stay open; the owner answers it on the card.
 */
export const branchWritesOf = (module: ModuleDefinition, raw: unknown): ReadonlyArray<ProposedBranch> => {
    if (!Array.isArray(raw)) return []
    const kept = new Map<string, ProposedBranch>()
    for (const item of raw) {
        if (!isObject(item) || item.kind !== "branch") continue
        const action = clean(item.action, 60)
        const known = module.authorityActions.some((candidate) => candidate.action === action && candidate.amountLimit)
        const boundaryVnd = vndOf(item.boundary)
        const approverName = clean(item.approver, 80)
        if (!known || boundaryVnd === null || boundaryVnd <= 0 || approverName === "") continue
        kept.set(action, {
            gateKey: clean(item.gate, 60),
            kind: "branch",
            payload: {
                action,
                boundaryVnd,
                belongsTo: belongsOf(item.belongs),
                approverName,
                approverMemberId: null,
                quote: clean(item.quote, 300),
            },
        })
    }
    return [...kept.values()].slice(0, BRANCHES_PER_TURN)
}

/** What the model is told to ask about for each place of the graph that is still vague, one place at a time. */
const GAP_QUESTIONS: Readonly<Record<string, string>> = {
    boundary:
        'the amount where one band ends and the next begins is not exact (for example "under 5 million" and "above 5 million" leave 5 million itself open). Ask which band the exact amount belongs to.',
    approver_missing: "a band asks a person, but the owner has not said who. Ask who should be asked for it.",
    approver_absent: "the person who is asked for a band has no active seat. Ask who should be asked instead.",
    on_timeout:
        "the owner has not said what happens when the person asked does not answer in time. Ask who should be asked next, or whether the work should stop.",
    else_unset:
        "no band covers the amounts nobody named. Ask what should happen to them; the safe answer is to ask a person.",
    approver_no_grant:
        "the person who is asked for a band is not allowed to approve amounts that high. Ask who else can, or whether the person should be given the right.",
}

/** The line of the prompt about the first vague place of the graph, and nothing else; empty when the graph has none. */
export const graphGapLine = (code: string | null): string => {
    const question = code === null ? undefined : GAP_QUESTIONS[code]
    return question === undefined
        ? ""
        : `The agent flow has one vague place: ${question} Ask the owner about THAT this turn and nothing else about the flow. If the owner answers, add a write {"gate": <gateKey>, "kind": "branch", "action": <action>, "boundary": <integer VND>, "approver": <name of the person asked above the line>, "belongs": "lower"|"higher" (which band the exact amount belongs to; leave out when not said), "quote": <the words of the owner>}.`
}
