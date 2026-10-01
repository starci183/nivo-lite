import type { Locale } from "@/i18n/core"
import type { Message } from "@/lib/types"
import { dayKey, dayLabel, type DayWords } from "./format"
import type { WorkItemView } from "@/lib/flow-types"
import type { PendingApproval } from "./queries"

const GROUP_WINDOW_MS = 5 * 60_000

/** One entry of the rendered thread: a day separator, a message or an approval request. */
export type ThreadItem =
  | { readonly kind: "day"; readonly key: string; readonly label: string }
  | { readonly kind: "message"; readonly key: string; readonly message: Message; readonly isContinuation: boolean }
  | { readonly kind: "approval"; readonly key: string; readonly approval: PendingApproval }
  | { readonly kind: "exception"; readonly key: string; readonly item: WorkItemView }

type Entry = { readonly at: string; readonly message?: Message; readonly approval?: PendingApproval; readonly exception?: WorkItemView }

/**
 * Merge team messages and approval requests by time, insert day separators and mark consecutive
 * messages from the same author as continuations (Zalo-style grouping).
 */
export const buildThread = (
  messages: ReadonlyArray<Message>,
  approvals: ReadonlyArray<PendingApproval>,
  exceptions: ReadonlyArray<WorkItemView>,
  nowIso: string,
  locale: Locale,
  words: DayWords,
): ReadonlyArray<ThreadItem> => {
  const entries: Array<Entry> = [
    ...messages.map((message) => ({ at: message.created_at, message })),
    ...approvals.map((approval) => ({ at: approval.execution.created_at, approval })),
    ...exceptions.map((exception) => ({ at: exception.created_at, exception })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const items: Array<ThreadItem> = []
  let previousDay: string | null = null
  let previous: Message | null = null
  for (const entry of entries) {
    const day = dayKey(entry.at)
    const isNewDay = previousDay !== day
    if (isNewDay) items.push({ kind: "day", key: `day-${day}`, label: dayLabel(day, nowIso, locale, words) })
    previousDay = day
    if (entry.approval) {
      items.push({ kind: "approval", key: `approval-${entry.approval.execution.id}`, approval: entry.approval })
      previous = null
      continue
    }
    if (entry.exception) {
      items.push({ kind: "exception", key: `exception-${entry.exception.id}`, item: entry.exception })
      previous = null
      continue
    }
    const message = entry.message
    if (!message) continue
    const isContinuation =
      !isNewDay &&
      previous !== null &&
      message.author_kind !== "system" &&
      previous.author_kind === message.author_kind &&
      previous.author_name === message.author_name &&
      new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < GROUP_WINDOW_MS
    items.push({ kind: "message", key: message.id, message, isContinuation })
    previous = message
  }
  return items
}
