import { SCRIPT_MAX_SCENES } from "./video.constants"
import type { ProjectInputs, SceneRole, ScriptScene } from "./video.types"

const MARKS = new RegExp(`[${String.fromCodePoint(0x300)}-${String.fromCodePoint(0x36f)}]`, "g")
const D_BAR = new RegExp(String.fromCodePoint(0x111), "gi")

/** The text without accents (and the barred d folded to d), for matching and for file names. */
export const asciiFold = (text: string): string => text.normalize("NFD").replace(MARKS, "").replace(D_BAR, "d")

/** The empty inputs of a new project. */
export const EMPTY_INPUTS: ProjectInputs = { sourceIds: [], notes: "", media: [], auto: false }

/** The roles a scene may play. */
const ROLES: ReadonlyArray<SceneRole> = ["hook", "body", "cta"]

/** A model answer read into a script. */
export interface ParsedScript {
    /** The working title the model proposed. */
    readonly title: string
    /** The cleaned scenes. */
    readonly scenes: ReadonlyArray<ScriptScene>
}

/** How many scenes a script has and how long each voiceover runs for a target length. */
export interface ScenePlan {
    /** Number of scenes. */
    readonly scenes: number
    /** Characters of voiceover per scene. */
    readonly voiceChars: number
}

/** Whether a value is a plain object. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const stringList = (value: unknown, max: number): ReadonlyArray<string> =>
    Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 300)
              .slice(0, max)
        : []

/** Whatever is stored for a project's inputs becomes clean inputs. Never throws. */
export const readInputs = (raw: unknown): ProjectInputs => {
    const source = isRecord(raw) ? raw : {}
    return {
        sourceIds: stringList(source.source_ids ?? source.sourceIds, 12),
        notes: typeof source.notes === "string" ? source.notes.slice(0, 600) : "",
        media: stringList(source.media, 40),
        auto: source.auto === true,
    }
}

/** Inputs in the shape the database stores. */
export type StoredInputs = {
    source_ids: Array<string>
    notes: string
    media: Array<string>
    auto: boolean
}

/** Inputs as the database stores them. */
export const writeInputs = (inputs: ProjectInputs): StoredInputs => ({
    source_ids: [...inputs.sourceIds],
    notes: inputs.notes,
    media: [...inputs.media],
    auto: inputs.auto,
})

/** One scene in the shape the database stores. */
export type StoredScene = {
    id: string
    role: SceneRole
    caption: string
    voiceover: string
    visual: string
    media: string | null
}

/** Scenes as the database stores them. */
export const writeScript = (scenes: ReadonlyArray<ScriptScene>): Array<StoredScene> =>
    scenes.map((scene) => ({ ...scene }))

const newId = (): string => crypto.randomUUID()

/** A blank scene. */
export const newScene = (role: SceneRole = "body"): ScriptScene => ({
    id: newId(),
    role,
    caption: "",
    voiceover: "",
    visual: "",
    media: null,
})

const clip = (value: unknown, max: number): string =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : ""

const roleOf = (value: unknown): SceneRole => ROLES.find((role) => role === value) ?? "body"

const sceneOf = (raw: unknown): ReadonlyArray<ScriptScene> => {
    if (!isRecord(raw)) return []
    const caption = clip(raw.caption, 160)
    const voiceover = clip(raw.voiceover, 420)
    if (caption === "" && voiceover === "") return []
    return [
        {
            id: typeof raw.id === "string" && raw.id !== "" ? raw.id.slice(0, 60) : newId(),
            role: roleOf(raw.role),
            caption,
            voiceover,
            visual: clip(raw.visual, 200),
            media: typeof raw.media === "string" && raw.media !== "" ? raw.media.slice(0, 300) : null,
        },
    ]
}

/** Whatever is stored or typed becomes clean scenes (at most 12). Never throws. */
export const readScript = (raw: unknown): ReadonlyArray<ScriptScene> =>
    Array.isArray(raw) ? raw.slice(0, SCRIPT_MAX_SCENES).flatMap(sceneOf) : []

/** The closers a repaired object still owes, innermost first. */
const closersOf = (stack: ReadonlyArray<string>, upTo: string): string => {
    const index = stack.lastIndexOf(upTo)
    return stack
        .slice(index + 1)
        .reverse()
        .map((open) => (open === "{" ? "}" : "]"))
        .join("")
}

/**
 * The first JSON object of a model answer, with its brackets repaired when the model got the nesting wrong (a missing closer
 * before a bracket is the usual slip). Null when the object is cut off: half a scene is worse than asking again.
 */
export const extractJsonObject = (text: string): string | null => {
    const body = text.replace(/```(?:json)?/gi, "").trim()
    const start = body.indexOf("{")
    if (start < 0) return null
    const stack: Array<string> = []
    let out = ""
    let inString = false
    let escaped = false
    for (const char of body.slice(start)) {
        if (inString) {
            out += char
            if (escaped) escaped = false
            else if (char === "\\") escaped = true
            else if (char === '"') inString = false
            continue
        }
        if (char === '"') {
            inString = true
            out += char
            continue
        }
        if (char === "{" || char === "[") {
            stack.push(char)
            out += char
            continue
        }
        if (char === "}" || char === "]") {
            const want = char === "}" ? "{" : "["
            if (!stack.includes(want)) continue
            out += closersOf(stack, want)
            stack.length = stack.lastIndexOf(want)
            out = out.replace(/,\s*$/, "") + char
            if (stack.length === 0) return out
            continue
        }
        out += char
    }
    return null
}

const withEnds = (scenes: ReadonlyArray<ScriptScene>): ReadonlyArray<ScriptScene> =>
    scenes.map((scene, index, all) => {
        if (index === 0) return { ...scene, role: "hook" }
        if (index === all.length - 1 && all.length > 1) return { ...scene, role: "cta" }
        return scene.role === "hook" || scene.role === "cta" ? { ...scene, role: "body" } : scene
    })

const parseJson = (json: string): unknown => {
    try {
        return JSON.parse(json)
    } catch {
        return null
    }
}

/** What OpenClaw returns becomes a title and scenes; the first object is used even inside a fence or prose. */
export const parseScriptOutput = (text: string): ParsedScript | null => {
    const json = extractJsonObject(text)
    if (json === null) return null
    const parsed = parseJson(json)
    const source = isRecord(parsed) ? parsed : {}
    const scenes = withEnds(readScript(source.scenes))
    if (scenes.length < 2) return null
    return { title: clip(source.title, 120), scenes }
}

/** Whether a media path is a video or an image. */
export const mediaKindOf = (path: string): "video" | "image" => (/\.(mp4|mov|webm)$/i.test(path) ? "video" : "image")

/** The name shown for an uploaded file: "<uuid>-photo-1.jpg" becomes "photo-1.jpg". */
export const mediaLabel = (path: string): string =>
    path
        .split("/")
        .pop()
        ?.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "") ?? path

/** Rough seconds one scene takes (the renderer measures the real voice). */
export const estimateSceneSeconds = (scene: ScriptScene): number => {
    const spoken = scene.voiceover.length / 14 + 0.8
    const read = scene.caption.length / 16 + 1.2
    return Math.min(15, Math.max(2.5, spoken, read, 3))
}

/** Rough length of the video from the script. */
export const estimateScriptSeconds = (scenes: ReadonlyArray<ScriptScene>): number =>
    Math.round(scenes.reduce((sum, scene) => sum + estimateSceneSeconds(scene), 0))

/** How many scenes and how long each voiceover runs for a target length (about 14 characters a second). */
export const scenePlan = (seconds: number): ScenePlan => {
    const scenes = Math.min(8, Math.max(3, Math.round(seconds / 6)))
    return { scenes, voiceChars: Math.max(40, Math.round((seconds / scenes - 0.8) * 14)) }
}

/** Whether a path sits in the workspace folder of the media bucket. */
export const inWorkspaceFolder = (path: string, workspaceId: string): boolean =>
    path.toLowerCase().startsWith(`${workspaceId.toLowerCase()}/`)

/** A "#rrggbb" colour in lower case, or null when the text is not one. */
export const colorOf = (value: string): string | null =>
    /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : null
