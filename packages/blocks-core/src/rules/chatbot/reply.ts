/** The longest reply a person may send. */
export const REPLY_MAX = 4000

/** The reply a person typed, or why it cannot be sent. */
export type ReplyBody =
    { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: "empty" | "too_long" }

/** The words to send: the draft without the blanks around it, one to 4000 characters. */
export const replyBodyOf = (draft: string): ReplyBody => {
    const text = draft.trim()
    if (text.length === 0) return { ok: false, reason: "empty" }
    return text.length > REPLY_MAX ? { ok: false, reason: "too_long" } : { ok: true, text }
}
