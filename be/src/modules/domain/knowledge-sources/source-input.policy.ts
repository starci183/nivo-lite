import { IsNull, Not, type FindOptionsWhere } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { ok, refused, type Outcome } from "@modules/platform/primitives"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import {
    LEGACY_OFFICE_EXTENSIONS,
    MAX_SOURCE_CHARS,
    MAX_UPLOAD_BYTES,
    PUBLIC_DOCUMENT_ORIGIN,
    SOURCE_KINDS,
    type AddSourceInput,
    type DocumentVisibility,
    type SourceKind,
    type UpdateSourceInput,
} from "./knowledge-sources.contracts"
import { DOCUMENT_AREAS, type MaybeSourceMove, type MaybeWholeDocument } from "./source-areas.contracts"
import type { KnowledgeSourceEntity } from "./persistence/entities"

/** A new source after its input was checked and tidied. */
export interface NormalizedSource {
    /** text, faq, file or url. */
    readonly kind: SourceKind
    /** The title, at most 160 characters. */
    readonly title: string
    /** The text of a note or Q&A list, or the address of a link until it is read; empty for a file. */
    readonly content: string
    /** The storage object of a file. */
    readonly storagePath: string | null
    /** The address of a link. */
    readonly sourceUrl: string | null
    /** The topic, at most 80 characters. */
    readonly topic: string | null
    /** Up to twelve distinct tags of at most forty characters. */
    readonly tags: ReadonlyArray<string>
    /** The module, or null for every module. */
    readonly module: string | null
    /** The agent instance, or null for every instance. */
    readonly installationId: string | null
    /** The area the member uploads it into (owner 2026-11-12: "what you upload is what you get"); internal when none is given. */
    readonly visibility: DocumentVisibility
    /** Where it came from. */
    readonly origin: string | null
}

/** A change of metadata after its input was tidied; null keeps the value, an empty text clears a topic or module. */
export interface NormalizedUpdate {
    /** The new title. */
    readonly title: string | null
    /** The new topic. */
    readonly topic: string | null
    /** The new tags. */
    readonly tags: ReadonlyArray<string> | null
    /** The new module. */
    readonly module: string | null
    /** The area to move the document to (the MOVE); null keeps it. */
    readonly visibility: DocumentVisibility | null
}

/** The database instant of a write, for the `updated_at` column. */
export const NOW = (): string => "now()"

/** The columns of a source put back on the queue to be read from the start, with the changes that go with it. */
export const requeued = (
    changes: QueryDeepPartialEntity<KnowledgeSourceEntity>,
): QueryDeepPartialEntity<KnowledgeSourceEntity> => ({
    status: "queued",
    progress: 0,
    error: null,
    stage: null,
    stageDone: null,
    stageTotal: null,
    ...changes,
    updatedAt: NOW,
})

/** The columns a change of metadata writes: a null keeps the stored value, an empty topic or module clears it. */
export const metaChanges = (change: NormalizedUpdate): QueryDeepPartialEntity<KnowledgeSourceEntity> => ({
    ...(change.title === null ? {} : { title: change.title }),
    ...(change.topic === null ? {} : { topic: change.topic === "" ? null : change.topic }),
    ...(change.tags === null ? {} : { tags: [...change.tags] }),
    ...(change.module === null ? {} : { module: change.module === "" ? null : change.module }),
    ...(change.visibility === null ? {} : { visibility: change.visibility }),
    updatedAt: NOW,
})

/** The rows of a source the generic doors may change: any but an approved public document (its own approval flow changes it). */
export const genericSourceOf = (
    workspaceId: string,
    sourceId: string,
): Array<FindOptionsWhere<KnowledgeSourceEntity>> => [
    { id: sourceId, workspaceId, origin: IsNull() },
    { id: sourceId, workspaceId, origin: Not(PUBLIC_DOCUMENT_ORIGIN) },
]

/** Whether a metadata change moves who reads a source's passages (audience or module): the vector index must follow it. */
export const changesReaders = (changes: QueryDeepPartialEntity<KnowledgeSourceEntity>): boolean =>
    changes.visibility !== undefined || changes.module !== undefined

/** The area a visibility names, or null when it names none (absent, or another word). */
export const areaOf = (visibility: string | undefined): DocumentVisibility | null =>
    DOCUMENT_AREAS.find((area) => area === visibility) ?? null

/**
 * The move a written change makes, or null: a change that names an area moves the whole document (first source and parts) from the
 * area it was in to that one, by the member who asked. The same area again is a move too, so a move that stopped half way (its truths)
 * is finished by asking again.
 */
export const moveOf = (whole: MaybeWholeDocument, change: NormalizedUpdate, movedBy: string): MaybeSourceMove => {
    if (whole === null || change.visibility === null) return null
    return {
        sourceIds: whole.ids,
        title: change.title ?? whole.title,
        from: areaOf(whole.visibility) ?? "internal",
        to: change.visibility,
        movedBy,
    }
}

/** The result of checking the input of a new source. */
export type NormalizedSourceOutcome = Outcome<NormalizedSource, KnowledgeSourcesErrorCode>

const HTTP = /^https?:\/\//iu
const D_STROKE = String.fromCodePoint(0x111)
const CAPITAL_D_STROKE = String.fromCodePoint(0x110)

/** Distinct, trimmed tags of at most forty characters, twelve at most. */
export const tagsOf = (tags: ReadonlyArray<string> | undefined): Array<string> =>
    [...new Set((tags ?? []).map((tag) => tag.trim().slice(0, 40)).filter((tag) => tag !== ""))].slice(0, 12)

const textOrNull = (value: string | undefined, max: number): string | null => {
    const text = (value ?? "").trim().slice(0, max)
    return text === "" ? null : text
}

/** The title a link or file gets when the person gave none: the address without its scheme, or the file name without its extension. */
const defaultTitle = (kind: SourceKind, url: string, path: string): string => {
    if (kind === "url") return url.replace(/^https?:\/\//iu, "").slice(0, 160)
    return path
        .replace(/^.*\//u, "")
        .replace(/\.[^.]+$/u, "")
        .slice(0, 160)
}

/** The text a source is stored with: the address of a link, nothing for a file, the text of a note. */
const contentOf = (kind: SourceKind, url: string, content: string): string => {
    if (kind === "url") return url
    return kind === "file" ? "" : content
}

/** The title: the one given, else for a link or file the one derived from its address or name. */
const titleOf = (given: string, kind: SourceKind, url: string, path: string): string => {
    if (given !== "") return given
    return kind === "url" || kind === "file" ? defaultTitle(kind, url, path) : given
}

/** Whether the text of a note or Q&A list is present and not too long. */
const contentRefusal = (content: string): KnowledgeSourcesErrorCode | null => {
    if (content === "") return KnowledgeSourcesErrorCode.ContentEmpty
    return content.length > MAX_SOURCE_CHARS ? KnowledgeSourcesErrorCode.ContentTooLong : null
}

/** Whether a file path stays inside its workspace. */
const pathInside = (workspaceId: string, path: string): boolean => {
    if (!path.startsWith(`${workspaceId}/`)) return false
    return !path.includes("..")
}

/** The text, address or storage object a new source carries. */
interface SourceBody {
    /** The address of a link. */
    readonly url: string
    /** The storage object of a file. */
    readonly path: string
    /** The text of a note or Q&A list. */
    readonly content: string
}

/** Why the body of a source of this kind is refused, or null. */
const inputRefusal = (workspaceId: string, kind: SourceKind, body: SourceBody): KnowledgeSourcesErrorCode | null => {
    if (kind === "url") return HTTP.test(body.url) ? null : KnowledgeSourcesErrorCode.UrlInvalid
    if (kind === "file") return pathInside(workspaceId, body.path) ? null : KnowledgeSourcesErrorCode.StoragePathInvalid
    return contentRefusal(body.content)
}

/** Checks the input of a new source and tidies it: kind, title, text or link or file, tags, topic and visibility. */
export const normalizeSource = (workspaceId: string, input: AddSourceInput): NormalizedSourceOutcome => {
    const kind = SOURCE_KINDS.find((candidate) => candidate === input.kind)
    if (kind === undefined) return refused(KnowledgeSourcesErrorCode.SourceKindUnknown)
    const url = (input.url ?? "").trim()
    const path = (input.storagePath ?? "").trim()
    const content = (input.content ?? "").trim()
    let refusal = inputRefusal(workspaceId, kind, { url, path, content })
    const given = input.title.trim().slice(0, 160)
    const title = titleOf(given, kind, url, path)
    if (refusal === null && title === "") refusal = KnowledgeSourcesErrorCode.TitleRequired
    if (refusal !== null) return refused(refusal, { max: MAX_SOURCE_CHARS })
    return ok({
        kind,
        title,
        content: contentOf(kind, url, content),
        storagePath: kind === "file" ? path : null,
        sourceUrl: kind === "url" ? url : null,
        topic: textOrNull(input.topic, 80),
        tags: tagsOf(input.tags),
        module: textOrNull(input.module, 40),
        installationId: textOrNull(input.installationId, 40),
        visibility: areaOf(input.visibility) ?? "internal",
        origin: textOrNull(input.origin, 300),
    })
}

/** Tidies a change of metadata; a visibility is an area to move the document to (the MOVE), anything else in its place is refused. */
export const normalizeUpdate = (input: UpdateSourceInput): Outcome<NormalizedUpdate, KnowledgeSourcesErrorCode> => {
    const area = areaOf(input.visibility)
    if (input.visibility !== undefined && area === null) return refused(KnowledgeSourcesErrorCode.VisibilityUnknown)
    return ok({
        title: input.title === undefined ? null : input.title.trim().slice(0, 160) || "Untitled",
        topic: input.topic === undefined ? null : input.topic.trim().slice(0, 80),
        tags: input.tags === undefined ? null : tagsOf(input.tags),
        module: input.module === undefined ? null : input.module.trim().slice(0, 40),
        visibility: area,
    })
}

/** The new text of a source to read again, checked: present and not too long. */
export const replacementContent = (content: string | undefined): Outcome<string | null, KnowledgeSourcesErrorCode> => {
    if (content === undefined) return ok(null)
    const text = content.trim()
    const refusal = contentRefusal(text)
    return refusal === null ? ok(text) : refused(refusal, { max: MAX_SOURCE_CHARS })
}

/** A file name safe as a storage key: no folders, no marks, no spaces; at most 120 characters. */
export const safeFileName = (name: string): string => {
    const base = name
        .replace(/^.*[\\/]/u, "")
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(D_STROKE, "d")
        .replaceAll(CAPITAL_D_STROKE, "D")
        .replaceAll(/[^\w.-]+/gu, "_")
    let start = 0
    let end = base.length
    while (start < end && base[start] === "_") start += 1
    while (end > start && base[end - 1] === "_") end -= 1
    const trimmed = base.slice(start, end)
    return (trimmed === "" ? "file" : trimmed).slice(-120)
}

/** The new upload of a file to read again, checked: inside its workspace; null when none was given. */
export const replacementUpload = (
    workspaceId: string,
    path: string | undefined,
): Outcome<string | null, KnowledgeSourcesErrorCode> => {
    if (path === undefined) return ok(null)
    const trimmed = path.trim()
    return pathInside(workspaceId, trimmed) ? ok(trimmed) : refused(KnowledgeSourcesErrorCode.StoragePathInvalid)
}

/** Megabytes with one decimal, as the refusal prints them. */
const megabytes = (bytes: number): number => Math.round((bytes / (1024 * 1024)) * 10) / 10

/**
 * Whether a file may be uploaded at all, before any byte moves: it needs a name, an old binary Office file is refused with the advice to save it again,
 * and a file the browser says is larger than one document may be is refused with both sizes. The size is checked again on add.
 */
export const uploadVerdict = (filename: string, sizeBytes: number | null): Outcome<null, KnowledgeSourcesErrorCode> => {
    if (filename.trim() === "") return refused(KnowledgeSourcesErrorCode.FileNameRequired)
    const extension = /\.([a-z0-9]+)$/iu.exec(filename.trim())?.[1]?.toLowerCase() ?? ""
    if (LEGACY_OFFICE_EXTENSIONS.has(extension)) return refused(KnowledgeSourcesErrorCode.LegacyOffice)
    if (sizeBytes !== null && sizeBytes > MAX_UPLOAD_BYTES) {
        return refused(KnowledgeSourcesErrorCode.FileTooLarge, {
            size: megabytes(sizeBytes),
            max: megabytes(MAX_UPLOAD_BYTES),
        })
    }
    return ok(null)
}
