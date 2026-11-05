/** The most characters a message may hold when the spec names no limit. */
export const DEFAULT_MAX_LENGTH = 2000

/** Why a draft cannot be sent. */
export type DraftIssue = "empty" | "tooLong"

/** The words that would be sent: the draft without the blanks around it. */
export const textToSend = (draft: string): string => draft.trim()

/** Why the draft cannot be sent; null when it can. */
export const draftIssue = (draft: string, maxLength: number): DraftIssue | null => {
    const length = textToSend(draft).length
    if (length === 0) return "empty"
    return length > maxLength ? "tooLong" : null
}

/** Whether the send control works: the draft is fit to send and no send is in flight. */
export const canSend = (draft: string, maxLength: number, isSending: boolean): boolean =>
    !isSending && draftIssue(draft, maxLength) === null
