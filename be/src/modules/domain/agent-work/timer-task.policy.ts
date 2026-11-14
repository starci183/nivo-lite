import type { AgentTaskData } from "./agent-work.contracts"
import { TASK_WAKE_MAX_MS } from "./agent-work.policy"

/**
 * The generic timer (`nivo.tool.timer.arm` / `.cancel`, the `nivo.trigger.timer.due` they fire): how an armed timer is kept as ONE task
 * of the arming agent (key, title, data), and how the minute sweep reads it back. Pure engine logic: it names no business, and the
 * care steps' own timers (`care:` keys, `agents/care-task.policy.ts`) are a different key family on the same store.
 */

/** The prefix of the key of the agent task that holds an armed timer. */
export const TIMER_TASK_PREFIX = "timer"

/** The longest `ref` of a timer, in characters (NIVO's own bound: the caller's key). */
export const TIMER_REF_MAX = 64

/** The nearest a timer may be due, in minutes after the engine's clock (the sweep runs once a minute). */
export const TIMER_MIN_MINUTES = 1

/** The farthest a timer may be due: 365 days, in minutes. */
export const TIMER_MAX_MINUTES: number = 365 * 24 * 60

/** The most members the data a timer carries back may have. */
export const TIMER_DATA_MEMBERS_MAX = 20

/** The most bytes (UTF-8, as JSON) the data a timer carries back may take. */
export const TIMER_DATA_BYTES_MAX = 2_000

const MINUTE_MS = 60_000
const KEY_SEPARATOR = ":"
const TITLE_PREFIX = "timer due "
/** Between the due instant and the conversation in a task's title. */
const TITLE_CONVERSATION = " in "
/** The member of the timer a key names its subject by, or `none`. */
type SubjectKind = "contact" | "conversation" | "none"
const NO_SUBJECT = "-"

/** Whom a timer is about: the contact, else the conversation, else nobody (a timer of the agent). */
export interface TimerSubject {
    /** The contact (the engine's person) the arming run served, or null. */
    readonly contactId: string | null
    /** The customer conversation the arming run served, or null. */
    readonly conversationId: string | null
}

/** The member of a timer's key that names its subject: the kind and the id (or the placeholder for none). */
interface TimerSubjectKey {
    /** What the id is: a contact, a conversation, or none. */
    readonly kind: SubjectKind
    /** The id of that contact or conversation, or the placeholder when the timer has no subject. */
    readonly id: string
}

/**
 * The subject a timer is keyed by: the contact when the run had one, else its conversation. Both ids are not part of the key (a person
 * has many conversations, and a timer armed again from the wake it fired must find the same row); the due wake carries the one the key names.
 */
const subjectOf = (subject: TimerSubject): TimerSubjectKey => {
    if (subject.contactId !== null && subject.contactId !== "") return { kind: "contact", id: subject.contactId }
    if (subject.conversationId !== null && subject.conversationId !== "")
        return { kind: "conversation", id: subject.conversationId }
    return { kind: "none", id: NO_SUBJECT }
}

/**
 * The key of the agent task of a timer: once per agent (the store's own unit), subject and `ref`, so arming the same `ref` again for the
 * same subject moves the same task and another agent's or another subject's `ref` is separate. The `ref` is last, so it may hold the separator.
 */
export const timerTaskKeyOf = (subject: TimerSubject, ref: string): string => {
    const { kind, id } = subjectOf(subject)
    return [TIMER_TASK_PREFIX, kind, id, ref].join(KEY_SEPARATOR)
}

/** The conversation suffix of a timer task title: empty when the arming run had no conversation. */
const replyTarget = (conversationId?: string | null): string =>
    conversationId === undefined || conversationId === null || conversationId === ""
        ? ""
        : `${TITLE_CONVERSATION}${conversationId}`

/**
 * The title of the agent task of a timer: it carries the moment the timer is really due (the task itself wakes at most seven days ahead)
 * and, when the arming run had one, its conversation: the key names the contact when there is one, so the conversation a reminder must
 * reply on rides here and the due wake carries both.
 */
export const timerTaskTitleOf = (dueAt: string, conversationId?: string | null): string =>
    `${TITLE_PREFIX}${dueAt}${replyTarget(conversationId)}`

/** A timer as the agent task keeps it. */
export interface TimerTask {
    /** The caller's key. */
    readonly ref: string
    /** The subject the key names. */
    readonly subject: TimerSubject
    /** When the timer is really due, ISO 8601. */
    readonly dueAt: string
    /** What the timer carries back, or absent when the arm gave none. */
    readonly data?: AgentTaskData | undefined
}

/** The subject a key names, or null for a kind no key of ours has. */
const subjectFrom = (kind: string | undefined, id: string, titled: string | null): TimerSubject | null => {
    if (kind === "contact") return { contactId: id, conversationId: titled }
    if (kind === "conversation") return { contactId: null, conversationId: id }
    if (kind === "none") return { contactId: null, conversationId: null }
    return null
}

/** The timer an agent task holds (its key, its title and the data it keeps), or null for a task that is not one. */
export const timerTaskOf = (key: string, title: string, data?: AgentTaskData | null): TimerTask | null => {
    if (!key.startsWith(`${TIMER_TASK_PREFIX}${KEY_SEPARATOR}`) || !title.startsWith(TITLE_PREFIX)) return null
    const [, kind, id, ...rest] = key.split(KEY_SEPARATOR)
    const ref = rest.join(KEY_SEPARATOR)
    const [dueAt = "", ...named] = title.slice(TITLE_PREFIX.length).split(TITLE_CONVERSATION)
    const titled = named.length === 0 || named.join(TITLE_CONVERSATION) === "" ? null : named.join(TITLE_CONVERSATION)
    if (id === undefined || id === "" || ref === "" || Number.isNaN(Date.parse(dueAt))) return null
    const subject = subjectFrom(kind, id, titled)
    if (subject === null) return null
    return { ref, subject, dueAt, ...(data === null || data === undefined ? {} : { data }) }
}

/** What a caller asks a timer's due instant by: the instant itself, or minutes after the engine's clock. */
export interface TimerDueAsk {
    /** The instant, ISO 8601. */
    readonly dueAt?: string | undefined
    /** The minutes after the engine's clock. */
    readonly afterMinutes?: number | undefined
}

/** The instant a timer is due: the instant given, else the minutes given after the engine's clock. */
export const timerDueAtOf = (asked: TimerDueAsk, now: Date): Date | null => {
    if (asked.dueAt !== undefined) {
        const at = Date.parse(asked.dueAt)
        return Number.isNaN(at) ? null : new Date(at)
    }
    return asked.afterMinutes === undefined ? null : new Date(now.getTime() + asked.afterMinutes * MINUTE_MS)
}

/** Whether a moment is inside the bounds of a timer: at least a minute and at most 365 days after `now`. */
export const timerDueInBounds = (due: Date, now: Date): boolean => {
    const ahead = due.getTime() - now.getTime()
    return ahead >= TIMER_MIN_MINUTES * MINUTE_MS && ahead <= TIMER_MAX_MINUTES * MINUTE_MS
}

/** The once-key of the wake of a due timer: the task (agent, subject, `ref`) and the due instant, so a retried sweep fires once. */
export const timerEventKeyOf = (taskId: string, dueAt: Date): string => `timer:${taskId}:${String(dueAt.getTime())}`

/**
 * When the task of a timer wakes the sweep: the due instant, or seven days ahead when it is farther (a task wakes at most seven days
 * ahead; the sweep sets it forward again and fires nothing until the real due instant, which the title carries).
 */
export const timerWakeAtOf = (due: Date, now: Date): Date =>
    new Date(Math.min(due.getTime(), now.getTime() + TASK_WAKE_MAX_MS))
