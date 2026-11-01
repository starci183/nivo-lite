/** The largest file of a message; the back end holds the same limit on the stored bytes. */
const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024

/** The types a turn can read, as the picker offers them. */
const CHAT_FILE_TYPES: ReadonlyArray<string> = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

/** The list the file picker offers. */
export const CHAT_FILE_ACCEPT = CHAT_FILE_TYPES.join(",")

/** What is wrong with a chosen file: the words of the refusal are the caller's. */
export type ChatFileProblem = "fileTooLarge" | "fileTypeRefused"

/** The problem of a file, or null when it may be sent. */
export const chatFileProblemOf = (file: Pick<File, "size" | "type">): ChatFileProblem | null => {
    if (!CHAT_FILE_TYPES.includes(file.type)) return "fileTypeRefused"
    return file.size > CHAT_FILE_MAX_BYTES ? "fileTooLarge" : null
}
