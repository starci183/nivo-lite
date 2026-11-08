import type { IntentContract, IntentInputPart, IntentPromptSpec, IntentResultKind } from "./intent-contracts.contracts"
import { OWN_TURN_RESULT } from "./intent-frames.policy"
import type { IntentSay } from "./intent-policies.contracts"

/** The longest tool result a turn is given. */
const TOOL_RESULT_MAX = 20_000

const KIND_MAX = 40

/** The words with the opening of any data mark defused (`<data`, `</data>`, spaced or in capitals), so they cannot close the block they sit in. */
const defused = (text: string): string => text.replaceAll(/<(?=\s{0,8}\/?\s{0,8}data)/giu, "< ")

/** One piece of data, wrapped and marked: whatever it says, it stays data. */
export const dataTagOf = (kind: string, text: string): string => {
    const name = kind.replaceAll(/[^a-z0-9_]/giu, "_").slice(0, KIND_MAX)
    return `<data kind="${name}">\n${defused(text.trim())}\n</data>`
}

/** Writes a value as JSON without ever throwing: a repeated object reads `[circular]` and a big integer reads as its digits. */
const jsonOf = (value: unknown): string => {
    const seen = new WeakSet<object>()
    const replacer = (_name: string, member: unknown): unknown => {
        if (typeof member === "bigint") return member.toString()
        if (typeof member !== "object" || member === null) return member
        if (seen.has(member)) return "[circular]"
        seen.add(member)
        return member
    }
    return JSON.stringify(value, replacer) ?? ""
}

/** The wrapper of a tool result: the words of any tool, whoever spoke through it, are data and never an instruction. */
export const toolResultOf = (value: unknown): string =>
    dataTagOf("tool_result", (typeof value === "string" ? value : jsonOf(value)).slice(0, TOOL_RESULT_MAX))

const bullet = (line: string): string => `- ${line}`

const inputOf = (parts: ReadonlyArray<IntentInputPart>, say: IntentSay): string =>
    [
        say("intentContracts.prompt.input"),
        say("intentContracts.prompt.inputNote"),
        ...parts.map((part) => dataTagOf(part.kind, part.text)),
    ].join("\n")

const taskOf = (active: ReadonlyArray<IntentContract>, pinned: string | null, say: IntentSay): string => {
    const lines = active.map((contract) => bullet(`${contract.intent} (${contract.label}): ${contract.task}`))
    const sentence = pinned === null ? "intentContracts.prompt.taskPick" : "intentContracts.prompt.taskPinned"
    return [say("intentContracts.prompt.task"), say(sentence, { intent: pinned ?? "" }), ...lines].join("\n")
}

/** The limits every active intent shares are written once; the rest follow under the intent they bind. */
const limitsOf = (active: ReadonlyArray<IntentContract>, say: IntentSay): string => {
    const common = (active[0]?.limits ?? []).filter((limit) =>
        active.every((contract) => contract.limits.includes(limit)),
    )
    const apart = active.flatMap((contract) => {
        const own = contract.limits.filter((limit) => !common.includes(limit))
        return own.length === 0 ? [] : [`${contract.intent}:`, ...own.map((line) => bullet(line))]
    })
    return [say("intentContracts.prompt.limits"), ...common.map((line) => bullet(line)), ...apart].join("\n")
}

/** Intents that answer the same way are written together, so the shape of a result is not repeated for each. */
const grouped = (
    active: ReadonlyArray<IntentContract>,
    keyOf: (contract: IntentContract) => string,
): ReadonlyArray<{ readonly intents: ReadonlyArray<string>; readonly key: string }> => {
    const byKey = new Map<string, ReadonlyArray<string>>()
    for (const contract of active) {
        const key = keyOf(contract)
        byKey.set(key, [...(byKey.get(key) ?? []), contract.intent])
    }
    return [...byKey].map(([key, intents]) => ({ key, intents }))
}

const kindFor = (contract: IntentContract, pinned: string | null): IntentResultKind =>
    contract.ownTurn && pinned === null ? OWN_TURN_RESULT : contract.result

const resultOf = (active: ReadonlyArray<IntentContract>, pinned: string | null, say: IntentSay): string => {
    const shapes = grouped(active, (contract) => say(`intentContracts.result.${kindFor(contract, pinned)}`))
    return [
        say("intentContracts.prompt.result"),
        say("intentContracts.prompt.envelope"),
        ...shapes.map((shape) => bullet(`${shape.intents.join(", ")}: ${shape.key}`)),
    ].join("\n")
}

const checksOf = (active: ReadonlyArray<IntentContract>, pinned: string | null, say: IntentSay): string => {
    const checked = active.filter(
        (contract) => kindFor(contract, pinned) !== OWN_TURN_RESULT && contract.checks.length > 0,
    )
    const sets = grouped(checked, (contract) =>
        contract.checks.map((check) => say(`intentContracts.check.${check}`)).join("; "),
    )
    return [
        say("intentContracts.prompt.checks"),
        say("intentContracts.prompt.checksNote"),
        ...sets.map((set) => bullet(`${set.intents.join(", ")}: ${set.key}`)),
    ].join("\n")
}

/**
 * The prompt of a turn, whatever woke it: the identity line, then the five parts in sequence, input, task, limits, result and checks. Every
 * part of the input is wrapped in a data tag whose closing mark is defused. A turn pinned to an intent shows that one alone, and an
 * intent that runs in a turn of its own is asked for the intent only until it is pinned.
 */
export const buildIntentPrompt = (spec: IntentPromptSpec, say: IntentSay): string => {
    const active =
        spec.pinned === null ? spec.contracts : spec.contracts.filter((contract) => contract.intent === spec.pinned)
    return [
        spec.identity,
        inputOf(spec.input, say),
        taskOf(active, spec.pinned, say),
        limitsOf(active, say),
        resultOf(active, spec.pinned, say),
        checksOf(active, spec.pinned, say),
    ].join("\n\n")
}
