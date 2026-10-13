import { linkProblemOf, nextId } from "./link-rows"
import { DOCUMENT_MAX_BYTES } from "./queue"
import type { QueueItem } from "./queue"
import type { ArchiveResult, ArchiveRow } from "./zip"
import { SUPPORTED_FILE } from "./zip-names"

/** Why a file cannot be taken, as a catalog key, or undefined. */
const problemOfFile = (file: File): string | undefined => {
    if (!SUPPORTED_FILE.test(file.name)) return "errBadType"
    return file.size > DOCUMENT_MAX_BYTES ? "errTooBig" : undefined
}

/** The queue item of a file the person chose. */
export const itemOfFile = (file: File): QueueItem => {
    const problem = problemOfFile(file)
    return {
        id: nextId(),
        kind: "file",
        name: file.name,
        size: file.size,
        file,
        status: problem === undefined ? "waiting" : "failed",
        ...(problem === undefined ? {} : { error: problem }),
    }
}

/** The queue item of a link. */
export const itemOfLink = (url: string): QueueItem => {
    const problem = linkProblemOf(url)
    return {
        id: nextId(),
        kind: "link",
        name: url,
        status: problem === null ? "waiting" : "failed",
        ...(problem === null ? {} : { error: problem }),
    }
}

/** The queue item of one entry of an archive. */
const itemOfRow = (zipName: string, row: ArchiveRow): QueueItem => ({
    id: nextId(),
    kind: "file",
    name: row.path,
    size: row.size,
    ...(row.file === undefined ? {} : { file: row.file }),
    origin: row.dir === "" ? zipName : `${zipName} / ${row.dir}`,
    ...(row.topic === undefined ? {} : { topic: row.topic }),
    status: row.error === undefined ? "waiting" : "failed",
    ...(row.error === undefined ? {} : { error: row.error }),
})

/** The queue items an opened archive gives: its entries, or one failed item when the whole archive was refused or has nothing to read. */
export const itemsOfZip = (zip: File, result: ArchiveResult): ReadonlyArray<QueueItem> => {
    const refused = result.abort ?? (result.rows.length === 0 && result.skipped === 0 ? "errZipEmpty" : undefined)
    if (refused !== undefined) {
        return [{ id: nextId(), kind: "file", name: zip.name, size: zip.size, status: "failed", error: refused }]
    }
    return result.rows.map((row) => itemOfRow(zip.name, row))
}
