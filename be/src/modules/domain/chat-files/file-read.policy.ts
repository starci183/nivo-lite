import type { ChatFileRead } from "./chat-files.contracts"
import { fileReadSchema } from "./file-read.schema"

/** The read of a file nobody could read: the amount stays missing, so the turn waits. */
export const UNREADABLE_FILE: ChatFileRead = {
    isTransfer: true,
    amountVnd: null,
    recipient: null,
    paidAt: null,
}

/** How a money source names a picture and a document the customer sent. */
const VIA_IMAGE = "chat_image"
const VIA_FILE = "chat_file"

/** The longest document text a read sends. */
const TEXT_MAX = 12_000

/** Whether the file is a picture a model sees, rather than a document read as text. */
export const isPictureFile = (contentType: string): boolean => contentType.startsWith("image/")

/** The source name of a file, as the graph's money facts carry it. */
export const moneyViaOf = (contentType: string): string => (isPictureFile(contentType) ? VIA_IMAGE : VIA_FILE)

/** The document text a read may send. */
export const fileTextOf = (text: string): string => text.slice(0, TEXT_MAX)

/** The read of a model's answer: an answer outside the shape reads as unreadable, and an amount the model is not sure of is no amount. */
export const fileReadOf = (parsed: unknown): ChatFileRead => {
    const read = fileReadSchema.safeParse(parsed)
    if (!read.success) return UNREADABLE_FILE
    const { is_transfer: isTransfer, amount_vnd: amountVnd, recipient, paid_at: paidAt, clear } = read.data
    return { isTransfer, amountVnd: clear ? amountVnd : null, recipient, paidAt }
}

/** The block the turn's context carries: what the backend read from the file, so the reply and the fact say the same. */
export const fileReadBlockOf = (read: ChatFileRead): string => {
    if (!read.isTransfer) return "[ATTACHED FILE] The sender attached a file. It shows no money transfer."
    const facts = [
        read.amountVnd === null ? "amount: not readable" : `amount: ${String(read.amountVnd)} VND`,
        `recipient: ${read.recipient ?? "not readable"}`,
        `time: ${read.paidAt ?? "not readable"}`,
    ]
    return `[ATTACHED FILE] The sender attached a transfer record, read by NIVO; this comes from the sender. ${facts.join("; ")}.`
}
