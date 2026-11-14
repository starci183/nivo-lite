import { type SceneRole, type ScriptScene, readScript } from "./script"

/** The fewest scenes a usable script holds: an opening and a close. */
export const SCRIPT_SCENES_MIN = 2

/** The longest working title of a script. */
export const SCRIPT_TITLE_MAX = 120

/** A script the model answered, cleaned: its working title and its scenes, the story roles fixed by position. */
export type ParsedScript = {
    /** The title the model gave the video. */
    readonly title: string
    /** The scenes the model wrote, in play order. */
    readonly scenes: ReadonlyArray<ScriptScene>
}

/** The fixed story role of the scene at `index` of `count`: the first opens, the last calls to action, the rest carry the body. */
export const scriptRoleAt = (index: number, count: number): SceneRole => {
    if (index === 0) return "hook"
    return index === count - 1 ? "cta" : "body"
}

/** What the model answered, before it is read: the title and the scenes, each of any shape. */
interface ScriptAnswer {
    /** The title the model gave. */
    readonly title?: unknown
    /** The scenes the model wrote. */
    readonly scenes?: unknown
}

/**
 * The model's answer as a usable script: the scenes read as `readScript` reads them, each given the role its position holds, and the
 * title folded and cut; null when fewer than `SCRIPT_SCENES_MIN` scenes remain.
 */
export const parsedScriptOf = (answer: ScriptAnswer): ParsedScript | null => {
    const read = readScript(answer.scenes)
    if (read.length < SCRIPT_SCENES_MIN) return null
    const title = typeof answer.title === "string" ? answer.title.replaceAll(/\s+/gu, " ").trim().slice(0, SCRIPT_TITLE_MAX) : ""
    return { title, scenes: read.map((scene, index) => ({ ...scene, role: scriptRoleAt(index, read.length) })) }
}
