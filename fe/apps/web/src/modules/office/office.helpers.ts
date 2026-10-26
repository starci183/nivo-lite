import type { ModuleIconName, OfficeBodyPart } from "@/modules/types"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { OPEN_WORK_STATUSES } from "./office.consts"
import type { OfficeAuthorRef, OfficeMessage, OfficeViewer, OfficeWork } from "./office.types"

/** The glyph of a module's mark; an unknown module draws the chatbot glyph. */
export const glyphOf = (module: string): ModuleIconName =>
    isModuleKey(module) ? MODULE_REGISTRY[module].glyph : MODULE_REGISTRY.chatbot.glyph

/** True when the module accepts commands from the Office. */
export const acceptsCommands = (module: string): boolean =>
    isModuleKey(module) && MODULE_REGISTRY[module].accepts.length > 0

/** The @handles a text mentions. */
export const mentionsOf = (text: string): ReadonlyArray<string> =>
    [...text.matchAll(/@([a-z0-9-]+)/g)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]))

const MENTION_PATTERN = /(@[a-z0-9-]+)/g
const MENTION_WHOLE = /^@[a-z0-9-]+$/

/** A text cut into plain pieces and @mentions, each with a stable key. */
export const bodyPartsOf = (body: string): ReadonlyArray<OfficeBodyPart> =>
    body.split(MENTION_PATTERN).map((text, index) => ({
        key: `${index}-${text}`,
        text,
        isMention: MENTION_WHOLE.test(text),
    }))

/** True for a line NIVO Core wrote itself (engine events, authority and decision replies). */
export const isNivoLine = (message: OfficeMessage): boolean =>
    message.authorKind !== "human" && message.agentId === null && /^nivo\b/i.test(message.authorName.trim())

/** True when the signed-in account wrote the line: by account id, and by display name only for a legacy line that carries no account id. */
export const isOwnAuthor = (author: OfficeAuthorRef, viewer: OfficeViewer): boolean =>
    author.userId === null ? viewer.name !== null && author.name === viewer.name : author.userId === viewer.userId

/** True while the work item still needs a person. */
export const isOpenWork = (work: OfficeWork): boolean => OPEN_WORK_STATUSES.includes(work.status)

/** The lines of two reads joined: the newest read wins on an id, oldest first. */
export const mergeMessages = (groups: ReadonlyArray<ReadonlyArray<OfficeMessage>>): ReadonlyArray<OfficeMessage> => {
    const byId = new Map(groups.flat().map((message) => [message.id, message]))
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** The text stored under one key of a work item's fields, or an empty text. */
export const fieldTextOf = (fields: unknown, key: string): string => {
    if (typeof fields !== "object" || fields === null) return ""
    const value: unknown = Object.entries(fields).find(([name]) => name === key)?.[1]
    return typeof value === "string" || typeof value === "number" ? String(value) : ""
}
