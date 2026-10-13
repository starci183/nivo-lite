import { linkKindOf } from "./links"

/** One input of the links list. */
export interface LinkInput {
    readonly id: string
    readonly value: string
}

/** A fresh id for a row or an item of the queue. */
export const nextId = (): string => `row-${crypto.randomUUID()}`

/** Why a link cannot be added, as a catalog key, or null: not a web address, or a Drive folder (which needs the Drive access of the workspace). */
export const linkProblemOf = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed === "") return null
    const kind = linkKindOf(trimmed)
    if (kind === "invalid") return "errBadLink"
    return kind === "drive-folder" ? "errNeedGrant" : null
}
