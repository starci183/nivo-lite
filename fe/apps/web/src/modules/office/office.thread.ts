import type { OfficeApproval, OfficeCandidate, OfficeMessage, OfficeWork } from "./office.types"

/** Two lines of one author closer than this form one group. */
const GROUP_WINDOW_MS = 5 * 60_000

/** The product day starts seven hours ahead of UTC. */
const DAY_OFFSET_MS = 7 * 3_600_000

/** One entry of the thread before any word is added. */
export type ThreadEntry =
    | { readonly kind: "day"; readonly key: string; readonly dayKey: string }
    | {
          readonly kind: "message"
          readonly key: string
          readonly message: OfficeMessage
          readonly isContinuation: boolean
          readonly isGroupEnd: boolean
      }
    | { readonly kind: "approval"; readonly key: string; readonly approval: OfficeApproval }
    | { readonly kind: "exception"; readonly key: string; readonly work: OfficeWork }
    | { readonly kind: "command"; readonly key: string; readonly candidate: OfficeCandidate }

/** A moment on the timeline: a line, an approval request or an exception. */
interface TimelineEntry {
    readonly at: string
    readonly message?: OfficeMessage
    readonly approval?: OfficeApproval
    readonly work?: OfficeWork
}

/** The calendar-day key of a moment, in product time. */
export const threadDayKey = (iso: string): string =>
    new Date(new Date(iso).getTime() + DAY_OFFSET_MS).toISOString().slice(0, 10)

const continues = (previous: OfficeMessage | null, message: OfficeMessage, isNewDay: boolean): boolean =>
    !isNewDay &&
    previous !== null &&
    message.authorKind !== "system" &&
    previous.authorKind === message.authorKind &&
    previous.authorName === message.authorName &&
    new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS

/** Where each command card goes: right under the line it answers. */
const cardsByMessage = (
    candidates: ReadonlyArray<OfficeCandidate>,
): ReadonlyMap<string, ReadonlyArray<OfficeCandidate>> => {
    const under = new Map<string, ReadonlyArray<OfficeCandidate>>()
    candidates.forEach((candidate) =>
        under.set(candidate.messageId, [...(under.get(candidate.messageId) ?? []), candidate]),
    )
    return under
}

/** Closes a group on its last bubble: the time shows once, there. */
const closeGroups = (items: ReadonlyArray<ThreadEntry>): ReadonlyArray<ThreadEntry> =>
    items.map((item, index) => {
        const next = items[index + 1]
        return item.kind === "message" && next?.kind === "message" && next.isContinuation
            ? { ...item, isGroupEnd: false }
            : item
    })

/**
 * Merges lines, approval requests and exceptions by time, adds day separators and groups consecutive lines of one author;
 * a command card sits right under its line.
 */
export const buildThreadEntries = (
    messages: ReadonlyArray<OfficeMessage>,
    approvals: ReadonlyArray<OfficeApproval>,
    works: ReadonlyArray<OfficeWork>,
    candidates: ReadonlyArray<OfficeCandidate>,
): ReadonlyArray<ThreadEntry> => {
    const under = cardsByMessage(candidates)
    const timeline: ReadonlyArray<TimelineEntry> = [
        ...messages.map((message) => ({ at: message.createdAt, message })),
        ...approvals.map((approval) => ({ at: approval.createdAt, approval })),
        ...works.map((work) => ({ at: work.createdAt, work })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    const items: Array<ThreadEntry> = []
    let previousDay: string | null = null
    let previous: OfficeMessage | null = null
    timeline.forEach((entry) => {
        const day = threadDayKey(entry.at)
        const isNewDay = previousDay !== day
        if (isNewDay) items.push({ kind: "day", key: `day-${day}`, dayKey: day })
        previousDay = day
        if (entry.approval) {
            items.push({ kind: "approval", key: `approval-${entry.approval.id}`, approval: entry.approval })
            previous = null
        } else if (entry.work) {
            items.push({ kind: "exception", key: `exception-${entry.work.id}`, work: entry.work })
            previous = null
        } else if (entry.message) {
            const message = entry.message
            const isContinuation = continues(previous, message, isNewDay)
            items.push({ kind: "message", key: message.id, message, isContinuation, isGroupEnd: true })
            previous = message
            const cards = under.get(message.id) ?? []
            cards.forEach((candidate) => items.push({ kind: "command", key: `command-${candidate.id}`, candidate }))
            if (cards.length > 0) previous = null
        }
    })
    return closeGroups(items)
}
