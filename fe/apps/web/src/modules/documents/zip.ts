/** Browser-side ZIP expansion for the Add documents drawer. Pure: no server code, no DOM beyond Blob and File. */
import { unzipSync } from "fflate"
import {
    SUPPORTED_FILE,
    centralFlags,
    decodeEntryName,
    isJunkEntry,
    isArchiveName,
    mimeFromName,
    topicFromFolder,
} from "./zip-names"

const MAX_ZIP_BYTES = 200_000_000
const MAX_ZIP_ENTRY_BYTES = 50 * 1024 * 1024
const MAX_ZIP_TOTAL_BYTES = 500_000_000
/** Declared uncompressed size over compressed size above which the archive is refused (zip bomb). Entries under the floor are exempt: a 1 KB run of spaces legitimately compresses 100x. */
const MAX_ZIP_RATIO = 100
const ZIP_RATIO_FLOOR = 1_000_000

/** Why an entry, or the whole archive, was refused; the words live in the catalog under the same name. */
export type ArchiveError = "errTooBig" | "errNestedZip" | "errZipBad" | "errZipTooBig" | "errZipTotal" | "errZipBomb"

/** One entry of an archive as the drawer lists it. */
export interface ArchiveRow {
    /** Path inside the archive (decoded, "/" separated). */
    readonly path: string
    /** Folders above the file, " / " separated (empty at the root). */
    readonly dir: string
    /** Top-level folder below the archive root folder, number prefix stripped. */
    readonly topic?: string
    /** Declared uncompressed size. */
    readonly size: number
    readonly error?: ArchiveError
    /** Present only for supported entries that were inflated. */
    readonly file?: File
}

/** What opening an archive gave. */
export interface ArchiveResult {
    readonly rows: ReadonlyArray<ArchiveRow>
    /** More supported-looking entries than the limit: the rest were not listed. */
    readonly truncated: boolean
    /** Entries left out because they are not readable documents (images, videos, .DS_Store): shown as one summary line, never as rows. */
    readonly skipped: number
    /** The whole archive was refused (nothing inflated). */
    readonly abort?: ArchiveError
}

/** One entry judged from the central directory. */
interface Planned {
    readonly index: number
    readonly raw: string
    readonly path: string
    readonly dir: string
    readonly topic?: string
    readonly size: number
    readonly error?: ArchiveError
}

/** What judging every entry gave. */
interface Plan {
    readonly planned: ReadonlyArray<Planned>
    readonly skipped: number
    readonly truncated: boolean
    readonly abort?: ArchiveError
}

/** One entry as the central directory declares it. */
interface Seen {
    readonly index: number
    readonly raw: string
    readonly path: string
    readonly size: number
    readonly compressed: number
}

const NOTHING: ArchiveResult = { rows: [], truncated: false, skipped: 0 }

/** Why one entry cannot be taken, or undefined. */
const errorOf = (entry: Seen, isNested: boolean): ArchiveError | undefined => {
    if (isNested) return "errNestedZip"
    return entry.size > MAX_ZIP_ENTRY_BYTES ? "errTooBig" : undefined
}

/** Whether the declared sizes of an entry look like a zip bomb. */
const isBomb = (entry: Seen): boolean =>
    entry.size >= ZIP_RATIO_FLOOR && entry.size > MAX_ZIP_RATIO * Math.max(1, entry.compressed)

/** Lists the entries by their declared sizes. Nothing is inflated: the filter always answers false. */
const listEntries = (data: Uint8Array): { readonly seen: ReadonlyArray<Seen>; readonly total: number } => {
    const flags = centralFlags(data)
    const seen: Array<Seen> = []
    let index = -1
    let total = 0
    unzipSync(data, {
        filter: (file) => {
            index++
            const path = decodeEntryName(file.name, flags === null ? true : ((flags[index] ?? 0) & 0x800) !== 0)
            if (!path.endsWith("/") && !path.endsWith("\\")) {
                total += file.originalSize
                seen.push({
                    index,
                    raw: file.name,
                    path: path.replaceAll("\\", "/"),
                    size: file.originalSize,
                    compressed: file.size,
                })
            }
            return false
        },
    })
    return { seen, total }
}

/** Why the whole archive is refused, or undefined. */
const abortOf = (total: number, entries: ReadonlyArray<Seen>): ArchiveError | undefined => {
    if (total > MAX_ZIP_TOTAL_BYTES) return "errZipTotal"
    return entries.some((entry) => !isArchiveName(entry.path) && isBomb(entry)) ? "errZipBomb" : undefined
}

/** Pass 1: judge every entry from the central directory declared sizes. */
const planZip = (data: Uint8Array, maxEntries: number): Plan => {
    const { seen, total } = listEntries(data)
    // Drive wraps a folder download in one root folder: it is not a topic, so topics are read below it.
    const kept = seen.filter((entry) => !isJunkEntry(entry.path))
    const isWrapped = kept.length > 0 && kept.every((entry) => entry.path.includes("/"))
    const root = isWrapped && new Set(kept.map((entry) => entry.path.split("/")[0])).size === 1 ? 1 : 0
    const readable = kept.filter((entry) => isArchiveName(entry.path) || SUPPORTED_FILE.test(entry.path))
    const abort = abortOf(total, readable)
    const planned = readable.slice(0, maxEntries).map((entry): Planned => {
        const segments = entry.path.split("/")
        const topic = topicFromFolder(segments.slice(root, -1)[0] ?? "")
        const error = errorOf(entry, isArchiveName(entry.path))
        return {
            index: entry.index,
            raw: entry.raw,
            path: entry.path,
            dir: segments.slice(0, -1).join(" / "),
            ...(topic === "" ? {} : { topic }),
            size: entry.size,
            ...(error === undefined ? {} : { error }),
        }
    })
    return {
        planned,
        skipped: seen.length - readable.length,
        truncated: readable.length > maxEntries,
        ...(abort === undefined ? {} : { abort }),
    }
}

/** Inflates one planned entry into a File, or says why it cannot. */
const inflate = (data: Uint8Array, entry: Planned): ArchiveRow => {
    const at = { path: entry.path, dir: entry.dir, ...(entry.topic === undefined ? {} : { topic: entry.topic }) }
    if (entry.error !== undefined) return { ...at, size: entry.size, error: entry.error }
    try {
        let want = -1
        // Re-walk the directory (cheap) but inflate only this entry: one buffer alive at a time before it is copied into the File.
        const out = unzipSync(data, {
            filter: () => {
                want++
                return want === entry.index
            },
        })
        const bytes = out[entry.raw]
        if (bytes === undefined) return { ...at, size: entry.size, error: "errZipBad" }
        if (bytes.length > MAX_ZIP_ENTRY_BYTES) return { ...at, size: bytes.length, error: "errTooBig" }
        const base = entry.path.split(/[\\/]/).pop() ?? entry.path
        return { ...at, size: bytes.length, file: new File([bytes.slice()], base, { type: mimeFromName(base) }) }
    } catch {
        return { ...at, size: entry.size, error: "errZipBad" }
    }
}

/** Plans an archive, or the reason it cannot be read. */
const planOrFault = (
    data: Uint8Array,
    maxEntries: number,
): { readonly plan: Plan } | { readonly fault: ArchiveError } => {
    try {
        return { plan: planZip(data, maxEntries) }
    } catch {
        return { fault: "errZipBad" }
    }
}

/**
 * Open a zip: refuse it by declared sizes first, then inflate only the supported entries, each into its own File (name = last path segment,
 * type from the extension). Entries are inflated one at a time, so memory is bounded by the accepted entries.
 */
export const readArchive = async (zip: Blob, maxEntries: number): Promise<ArchiveResult> => {
    if (zip.size > MAX_ZIP_BYTES) return { ...NOTHING, abort: "errZipTooBig" }
    const data = new Uint8Array(await zip.arrayBuffer())
    const outcome = planOrFault(data, maxEntries)
    if ("fault" in outcome) return { ...NOTHING, abort: outcome.fault }
    const { plan } = outcome
    if (plan.abort !== undefined) return { ...NOTHING, abort: plan.abort }
    return {
        rows: plan.planned.map((entry) => inflate(data, entry)),
        truncated: plan.truncated,
        skipped: plan.skipped,
    }
}
