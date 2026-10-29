import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { MAX_SOURCE_CHARS, SOURCE_KINDS } from "./knowledge-sources.contracts"
import type { AddSourceInput, SourceKind, UpdateSourceInput } from "./knowledge-sources.contracts"
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
    /** public or internal. */
    readonly visibility: "public" | "internal"
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
    /** The new visibility. */
    readonly visibility: "public" | "internal" | null
}

/** The database instant of a write, for the `updated_at` column. */
export const NOW = (): string => "now()"

/** The columns a change of metadata writes: a null keeps the stored value, an empty topic or module clears it. */
export const metaChanges = (change: NormalizedUpdate): QueryDeepPartialEntity<KnowledgeSourceEntity> => ({
    ...(change.title === null ? {} : { title: change.title }),
    ...(change.topic === null ? {} : { topic: change.topic === "" ? null : change.topic }),
    ...(change.tags === null ? {} : { tags: [...change.tags] }),
    ...(change.module === null ? {} : { module: change.module === "" ? null : change.module }),
    ...(change.visibility === null ? {} : { visibility: change.visibility }),
    updatedAt: NOW,
})

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

/** public only when asked for it. */
const visibilityOf = (value: string | undefined): "public" | "internal" => (value === "public" ? "public" : "internal")

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
        visibility: visibilityOf(input.visibility),
        origin: textOrNull(input.origin, 300),
    })
}

/** Tidies a change of metadata. */
export const normalizeUpdate = (input: UpdateSourceInput): NormalizedUpdate => ({
    title: input.title === undefined ? null : input.title.trim().slice(0, 160) || "Untitled",
    topic: input.topic === undefined ? null : input.topic.trim().slice(0, 80),
    tags: input.tags === undefined ? null : tagsOf(input.tags),
    module: input.module === undefined ? null : input.module.trim().slice(0, 40),
    visibility: input.visibility === undefined ? null : visibilityOf(input.visibility),
})

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
        .replace(/\p{Diacritic}/gu, "")
        .replaceAll(D_STROKE, "d")
        .replaceAll(CAPITAL_D_STROKE, "D")
        .replace(/[^\w.-]+/gu, "_")
    let start = 0
    let end = base.length
    while (start < end && base[start] === "_") start += 1
    while (end > start && base[end - 1] === "_") end -= 1
    const trimmed = base.slice(start, end)
    return (trimmed === "" ? "file" : trimmed).slice(-120)
}
