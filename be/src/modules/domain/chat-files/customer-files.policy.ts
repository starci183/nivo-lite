import { createHash } from "node:crypto"
import type { LineFile } from "@nivo-lite/agent-sdk/customer-send"

/**
 * The address a stored line keeps for a customer's file the shop holds in its own private store: `chat-file:<object path>`. It never
 * expires (a provider's address does): a reader turns it into bytes (the model's picture) or a short-lived address (a screen).
 */
export const CUSTOMER_FILE_REF = "chat-file:"

/** The most files of one customer message the shop keeps. */
export const CUSTOMER_FILES_MAX = 10

/** The extension each kept type is stored under. */
const EXTENSION_OF: Readonly<Record<string, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}

/** Whether a line's file address is one of the shop's own store. */
export const isCustomerFileRef = (url: string): boolean => url.startsWith(CUSTOMER_FILE_REF)

/** The object path behind a file address of the shop's own store, or null for any other address. */
export const customerFilePathOf = (url: string): string | null =>
    isCustomerFileRef(url) ? url.slice(CUSTOMER_FILE_REF.length) : null

/** Whether an object path is a customer file of this workspace (a reader never follows a path of another workspace). */
export const isCustomerFilePath = (workspaceId: string, path: string): boolean =>
    path.startsWith(`${workspaceId}/chat/customer/`) && !path.includes("..")

/**
 * The object path of the n-th file of one customer message: the same message heard again (a redelivery, the poll that reconciles a
 * webhook, a retried job) writes the same object, never a second one.
 */
export const customerObjectPathOf = (workspaceId: string, channelEventId: string, index: number, contentType: string): string => {
    const key = createHash("sha256").update(channelEventId).digest("hex").slice(0, 32)
    return `${workspaceId}/chat/customer/${key}-${String(index)}.${EXTENSION_OF[contentType] ?? "bin"}`
}

/**
 * The line's entry of a file the customer sent that the shop could NOT keep (the address failed, too large, not a picture or a
 * document): no address, so nothing is shown or read, and a step is told that a picture came that nobody has seen.
 */
export const unreadFileOf = (index: number, kind: "image" | "file", name: string): LineFile => ({
    id: `unread-${String(index)}`,
    url: "",
    name,
    contentType: kind === "image" ? "image/*" : "application/octet-stream",
})

/** What a step is told when pictures it was to be shown could not be read: a fact of its input, never words for the customer. */
export interface PicturesNotSeen {
    /** How many pictures were not shown. */
    readonly count: number
    /** The fact in words the model reads. */
    readonly note: string
}

/** The fact of pictures the customer sent that the step was not shown. */
export const picturesNotSeenOf = (count: number): PicturesNotSeen => ({
    count,
    note:
        `The customer sent ${String(count)} picture(s) that could not be read: you have NOT seen them. Never say or imply you saw ` +
        "them; when the answer needs them, tell the customer the shop will look and ask the founder in /chat.",
})

/**
 * The input of a model call with the fact of the pictures it was not shown (D-MX-4: the live consult told the customer it had received
 * the sample picture while it had seen nothing). An object input gets the member `picturesNotSeen`; any other input is wrapped. Nothing is
 * added when every picture was shown.
 */
export const withPicturesNotSeen = (input: unknown, notSeen: number): unknown => {
    if (notSeen <= 0) return input
    const fact = picturesNotSeenOf(notSeen)
    return typeof input === "object" && input !== null && !Array.isArray(input)
        ? { ...input, picturesNotSeen: fact }
        : { input, picturesNotSeen: fact }
}
