import { FILE_LIST_SCHEMA, FILE_REF_SCHEMA, fileMimeOf, mimeAccepted, type AnyEntityDefinition, type FileRef } from "@nivo-lite/agent-sdk/entity"
import { FLOW_F_ENTITIES } from "../entities/flow-f.entities"

/** What a declared `file` field takes: the content types it accepts and the largest file in bytes. */
export interface FileLimits {
    /** The accepted content types: exact (`video/mp4`) or a family (`image/*`). */
    readonly accept: ReadonlyArray<string>
    /** The largest file the field keeps, in bytes. */
    readonly maxBytes: number
    /** The most files a list field (`many`) holds; null for a field that holds one file. */
    readonly max: number | null
}

/** Why a chosen file cannot be put on a field: it is empty, of a type the field does not accept, or over the field's limit. */
export type FileProblem = "empty" | "type" | "size"

/** How a stored file is shown: as a picture, in a player, or as a file to open. */
export type FileKind = "image" | "video" | "other"

/** What a chosen file offers before any byte is sent. */
export interface ChosenFile {
    /** The content type the browser reports, possibly empty. */
    readonly type: string
    /** The size in bytes. */
    readonly size: number
}

const KIB = 1024
const MIB = KIB * 1024
const GIB = MIB * 1024

/**
 * The limits the entity declaration gives the `file` field `field` of the record type `type` (of the declared entities, or of the
 * ones given); null when the type or the field is not a declared file field.
 */
export const fileLimitsOf = (
    type: string,
    field: string,
    entities: ReadonlyArray<AnyEntityDefinition> = FLOW_F_ENTITIES,
): FileLimits | null => {
    const declared = entities.find((entity) => entity.name === type)?.fields[field]
    if (declared?.kind !== "file" || declared.accept === undefined || declared.maxBytes === undefined) return null
    return { accept: declared.accept, maxBytes: declared.maxBytes, max: declared.many === true ? (declared.max ?? null) : null }
}

/** The reference a bound record holds in a file field; null when the field is empty or holds something that is no reference. */
export const fileRefOf = (value: unknown): FileRef | null => {
    const parsed = FILE_REF_SCHEMA.safeParse(value)
    return parsed.success ? parsed.data : null
}

/** The references a bound record holds in a file field, in order: a list field's list, a single field's one reference; none when the field holds nothing valid. */
export const fileItemsOf = (limits: FileLimits, value: unknown): ReadonlyArray<FileRef> => {
    if (limits.max === null) {
        const only = fileRefOf(value)
        return only === null ? [] : [only]
    }
    const parsed = FILE_LIST_SCHEMA.safeParse(value)
    return parsed.success ? parsed.data : []
}

/** How many more files a list field takes after `count`; zero when it is full, and zero for a field that holds one file. */
export const roomOf = (limits: FileLimits, count: number): number =>
    limits.max === null ? 0 : Math.max(0, limits.max - count)

/** What is wrong with a chosen file against the field's limits, or null when the store should take it. The store checks again. */
export const fileProblemOf = (limits: FileLimits, file: ChosenFile): FileProblem | null => {
    if (file.size <= 0) return "empty"
    if (!mimeAccepted(limits.accept, fileMimeOf(file.type))) return "type"
    return file.size > limits.maxBytes ? "size" : null
}

/** How a stored file is shown, from its content type: an image or a video by its family, anything else (audio included) as a file to open. */
export const fileKindOf = (mime: string): FileKind => {
    if (mime.startsWith("image/")) return "image"
    return mime.startsWith("video/") ? "video" : "other"
}

/** How long before a signed address expires a block asks for a new one. */
const REFRESH_BEFORE_MS = 30_000

/** The shortest wait before asking again, so an address already near its end cannot start a loop. */
const REFRESH_MIN_MS = 5_000

/** The wait when the host gives no usable expiry. */
const REFRESH_FALLBACK_MS = 5 * 60_000

/** How many milliseconds to wait, at `nowMs`, before asking for a new address of one that expires at the ISO instant `expiresAt`. */
export const refreshWaitOf = (expiresAt: string, nowMs: number): number => {
    const wait = Date.parse(expiresAt) - nowMs - REFRESH_BEFORE_MS
    return Number.isFinite(wait) ? Math.max(REFRESH_MIN_MS, wait) : REFRESH_FALLBACK_MS
}

/** The unit that keeps a size short, and how many bytes it holds. */
const unitOf = (bytes: number): readonly [Intl.NumberFormatOptions["unit"], number] => {
    if (bytes >= GIB) return ["gigabyte", GIB]
    if (bytes >= MIB) return ["megabyte", MIB]
    return bytes >= KIB ? ["kilobyte", KIB] : ["byte", 1]
}

/** The size of a file in the viewer's language, in the unit that keeps it short: bytes, kilobytes, megabytes or gigabytes. */
export const bytesText = (bytes: number, locale: string): string => {
    const [unit, divisor] = unitOf(bytes)
    return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow", maximumFractionDigits: 1 }).format(
        bytes / divisor,
    )
}

/** The longest subtype a content type is named by (`mp4`); a longer one is named by the whole type. */
const SUBTYPE_SHOWN_MAX = 10

/**
 * The accepted types as words, one per entry: a family by the word the caller gives its top-level type (`image/*` as "images"), an
 * exact type by its subtype in capitals (`video/mp4` as "MP4"), anything the caller has no word for and no short subtype for as it is.
 */
export const acceptWordsOf = (accept: ReadonlyArray<string>, familyWords: Readonly<Record<string, string>>): string =>
    accept
        .map((entry) => {
            const [top = "", subtype = ""] = entry.split("/")
            if (subtype === "*") return (Object.hasOwn(familyWords, top) ? familyWords[top] : undefined) ?? entry
            return subtype.length <= SUBTYPE_SHOWN_MAX ? subtype.toUpperCase() : entry
        })
        .join(", ")
