import type { AgentWorkTranslator } from "./agentWork.wire"

/**
 * The one table of the plain words of the Work tab: every kind the back end names (what woke a turn, why a wake was skipped, a goal's
 * state, what a task waits for, an event, a tool) says a phrase of the catalog in Vietnamese and English, under the group's prefix and
 * the kind written in lower case with dots as underscores. A kind outside the group says the group's fallback phrase, or nothing when
 * the group has none, so a raw key never reaches the screen.
 */
interface Words {
    readonly prefix: string
    /** The kinds the catalog has a phrase for, as the back end writes them. */
    readonly known: ReadonlySet<string>
    /** The kind whose phrase an unknown kind says; none says nothing. */
    readonly fallback: string | null
}

const group = (prefix: string, kinds: string, fallback: string | null): Words => ({
    prefix,
    known: new Set(kinds.split(" ")),
    fallback,
})

const SOURCE = group("source_", "customer tag schedule internal", "internal")
const REASON = group("reason_", "quota killed breaker daily_cap not_applied agent_paused stale over_limit_vnd", null)
const GOAL_STATUS = group("goal_", "paused done dropped", null)
const GOAL_SOURCE = group("goalBy_", "owner module agent", "agent")
const TASK_STATUS = group("task_", "waiting", null)
const WAITING_ON = group("wait_", "approval member event", null)
const EVENT = group(
    "event_",
    "approval.resolved approval.reminder member.joined drive.linked drive.picked work.assigned",
    "other",
)
const TOOL = group(
    "tool_",
    "knowledge.search memory.read lead.create_or_update approval.request handoff.to_person conversation.handOff booking.find_slots booking.request booking.cancel tool.search tool.describe tool.call tool.sequence",
    "other",
)

/** The catalog key of a kind: lower case, dots as underscores. */
const keyOf = (words: Words, kind: string): string => `${words.prefix}${kind.toLowerCase().replaceAll(".", "_")}`

const wordOf = (words: Words, t: AgentWorkTranslator, kind: string | null | undefined): string => {
    const own = kind === null || kind === undefined || !words.known.has(kind) ? words.fallback : kind
    return own === null ? "" : t(keyOf(words, own))
}

/** What woke a turn. */
export const sourceWord = (t: AgentWorkTranslator, source: string): string => wordOf(SOURCE, t, source)

/** Why a wake was held or skipped; empty when the table has no plain reason. */
export const reasonWord = (t: AgentWorkTranslator, reason: string | null | undefined): string =>
    wordOf(REASON, t, reason)

/** A goal's state; empty for an active one, the row is the goal. */
export const goalStatusWord = (t: AgentWorkTranslator, status: string): string => wordOf(GOAL_STATUS, t, status)

/** Who set a goal. */
export const goalSourceWord = (t: AgentWorkTranslator, source: string): string => wordOf(GOAL_SOURCE, t, source)

/** A task's state; empty for an open one, it is in the list. */
export const taskStatusWord = (t: AgentWorkTranslator, status: string): string => wordOf(TASK_STATUS, t, status)

/** What a task waits for; empty when it waits for nothing. */
export const waitingOnWord = (t: AgentWorkTranslator, waitingOn: string | null | undefined): string =>
    wordOf(WAITING_ON, t, waitingOn)

/** The event a trigger waits for, in words. */
export const eventWord = (t: AgentWorkTranslator, event: string | null | undefined): string => wordOf(EVENT, t, event)

/** The families of tool ids the platform owns. */
const FAMILIES =
    "knowledge|memory|lead|approval|handoff|conversation|booking|tool|work|member|drive|zalo|telegram|sepay|channel|crm|office|agent"

/** A tool id in text a model wrote, after the verb it may have put in front ("Run knowledge.search"): the verbs come from the catalog. */
const toolIdOf = (verbs: string): RegExp =>
    new RegExp(String.raw`(?:\b(${verbs})\s+)?\b((?:${FAMILIES})\.[A-Za-z_]+)\b`, "gu")

/** A line a model wrote with its tool ids said as the act they do, and with a capital when a verb that began the line went with them. */
export const plainText = (t: AgentWorkTranslator, text: string): string =>
    text.replace(toolIdOf(t("toolVerbs")), (_found, verb: string | undefined, id: string) => {
        const act = wordOf(TOOL, t, id)
        return verb === undefined ? act : act.charAt(0).toUpperCase() + act.slice(1)
    })
