import type { OfficePreviewKind } from "@/modules/types"
import type { OfficeMessage } from "./office.types"
import type { OfficeWords } from "./office.words"

/** What a row's one-line preview is made of: what the last line is, its text and who wrote it (null for a direct row's other side). */
export interface OfficePreviewInput {
    readonly kind: OfficePreviewKind
    readonly body: string
    readonly author: string | null
}

/** The kind of a line: a card that carries a picture or a video previews as that; anything else is text. */
export const previewKindOf = (message: OfficeMessage): OfficePreviewKind => {
    const first = message.card?.media[0]
    return first === undefined ? "text" : first.kind
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim()

/** The label that stands for a line that is not text. */
const labelOf = (input: OfficePreviewInput, words: OfficeWords): string => {
    if (input.kind === "image") return words.t("previewImage")
    if (input.kind === "video") return words.t("previewVideo")
    if (input.kind === "file") return words.t("previewFile")
    if (input.kind === "call") return words.t("previewCall")
    if (input.kind === "reminder") return words.t("previewReminder")
    return collapse(input.body)
}

/** The preview of a row on ONE line: "You: text" for my line, "Name: text" for another sender in a group, a label for media. */
export const officePreviewOf = (input: OfficePreviewInput, meName: string | null, words: OfficeWords): string => {
    const text = labelOf(input, words)
    if (input.author === null) return text
    if (input.author === meName) return words.t("previewMine", { text })
    return words.t("previewFrom", { name: input.author, text })
}
