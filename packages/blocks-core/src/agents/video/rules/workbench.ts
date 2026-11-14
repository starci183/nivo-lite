import { FILE_REF_SCHEMA, type FileRef } from "@nivo-lite/agent-sdk/entity"
import { type ScriptScene, readScript } from "./script"
import { aspectOf, goalOf, normaliseColor, targetSecondsOf, type VideoAspect, type VideoGoal } from "./spec"

/** A stored record as the workbench reads it: its id, version, times and declared values. */
export type StoredRecord = {
    /** The id of the stored record. */
    readonly id: string
    /** The version of the record, as the store counts it. */
    readonly version: string
    /** When the record was created (ISO time). */
    readonly createdAt: string
    /** When the record last changed (ISO time). */
    readonly updatedAt: string
    /** The fields of the record, as the store holds them. */
    readonly data: Readonly<Record<string, unknown>>
}

/** One project as the workbench shows it. */
export type ProjectView = {
    /** The id of the project. */
    readonly id: string
    /** The version of the project record. */
    readonly version: string
    /** The title of the video. */
    readonly title: string
    /** What the video is for. */
    readonly goal: VideoGoal
    /** The shape of the video. */
    readonly aspect: VideoAspect
    /** How long the video should run. */
    readonly targetSeconds: number
    /** The owner's own words about what the video should show. */
    readonly brief: string
    /** Where the project stands (draft, rendering, ready, published, stuck). */
    readonly status: string
    /** The scenes of the script, in play order. */
    readonly scenes: ReadonlyArray<ScriptScene>
    /** How many scenes the script has. */
    readonly sceneCount: number
    /** The last error text of the project; null when there is none. */
    readonly lastError: string | null
    /** When the video was published (ISO time); null while it is not. */
    readonly publishedAt: string | null
    /** When the project last changed (ISO time). */
    readonly updatedAt: string
}

/** One making of a project's video as the workbench shows it: how many clips it keeps and whether it keeps a narration. */
export type RenderView = {
    /** The id of the render. */
    readonly id: string
    /** Where the render stands. */
    readonly state: string
    /** How many clips the render has. */
    readonly clipCount: number
    /** True when the render has a voice-over. */
    readonly hasVoice: boolean
    /** The error text of the render; null when there is none. */
    readonly error: string | null
    /** When the render was started (ISO time). */
    readonly createdAt: string
}

/** The files of one render as the workbench previews them: the composed video, its clips in scene order (none while it holds none) and its narration track. */
export type RenderFilesView = {
    /** The id of the render. */
    readonly id: string
    /** The finished video file; null until it is done. */
    readonly output: FileRef | null
    /** The clip files of the render. */
    readonly clips: ReadonlyArray<FileRef>
    /** The voice-over file; null when the render has none. */
    readonly voice: FileRef | null
}

/** The brand kit as the workbench shows and edits it; `id` is null before the workspace saved one. */
export type BrandView = {
    /** The id of the brand record; null when the shop has not set one up. */
    readonly id: string | null
    /** The shop name shown on the video. */
    readonly shopName: string
    /** The main brand colour; null when not set. */
    readonly primaryColor: string | null
    /** The second brand colour; null when not set. */
    readonly secondaryColor: string | null
    /** The voice the shop chose for its voice-overs; null when not set. */
    readonly voiceId: string | null
}

/** The brand kit of a workspace that saved none. */
export const EMPTY_BRAND: BrandView = {
    id: null,
    shopName: "",
    primaryColor: null,
    secondaryColor: null,
    voiceId: null,
}

const textOr = <T>(value: unknown, fallback: T): string | T => (typeof value === "string" ? value : fallback)

/** A project record as the workbench shows it; every value is read leniently, never trusted. */
export const projectViewOf = (record: StoredRecord): ProjectView => {
    const scenes = readScript(Reflect.get(Object(record.data["script"]), "scenes"))
    return {
        id: record.id,
        version: record.version,
        title: textOr(record.data["title"], ""),
        goal: goalOf(record.data["goal"]),
        aspect: aspectOf(record.data["aspect"]),
        targetSeconds: targetSecondsOf(record.data["targetSeconds"]),
        brief: textOr(record.data["brief"], ""),
        status: textOr(record.data["status"], "draft"),
        scenes,
        sceneCount: scenes.length,
        lastError: textOr(record.data["lastError"], null),
        publishedAt: textOr(record.data["publishedAt"], null),
        updatedAt: record.updatedAt,
    }
}

/** The file reference a record holds in a field; null when the field is empty or holds anything that is no reference. */
const fileRefOf = (value: unknown): FileRef | null => {
    const parsed = FILE_REF_SCHEMA.safeParse(value)
    return parsed.success ? parsed.data : null
}

/** The references a list file field holds, in order; anything that is no reference is left out, a field that is no list holds none. */
const fileRefsOf = (value: unknown): ReadonlyArray<FileRef> =>
    Array.isArray(value)
        ? value.flatMap((entry): ReadonlyArray<FileRef> => {
              const ref = fileRefOf(entry)
              return ref === null ? [] : [ref]
          })
        : []

/** A render record as the workbench shows it: how many clips it keeps and whether its narration is kept. */
export const renderViewOf = (record: StoredRecord): RenderView => ({
    id: record.id,
    state: textOr(record.data["state"], "generating"),
    clipCount: fileRefsOf(record.data["clips"]).length,
    hasVoice: fileRefOf(record.data["voice"]) !== null,
    error: textOr(record.data["error"], null),
    createdAt: record.createdAt,
})

/** A render record's files as the workbench previews them. */
export const renderFilesViewOf = (record: StoredRecord): RenderFilesView => ({
    id: record.id,
    output: fileRefOf(record.data["output"]),
    clips: fileRefsOf(record.data["clips"]),
    voice: fileRefOf(record.data["voice"]),
})

/** The brand kit record as the workbench shows it, or the empty kit when there is none. */
export const brandViewOf = (record: StoredRecord | null): BrandView =>
    record === null
        ? EMPTY_BRAND
        : {
              id: record.id,
              shopName: textOr(record.data["shopName"], ""),
              primaryColor: normaliseColor(record.data["primaryColor"]),
              secondaryColor: normaliseColor(record.data["secondaryColor"]),
              voiceId: textOr(record.data["voiceId"], null),
          }
