import { type ClipSeconds, clipSecondsOf } from "./spec"

/** Where a scene stands in the story: the opening that stops the scroll, a body point, or the closing call to action. */
export const SCENE_ROLES = ["hook", "body", "cta"] as const

/** One scene role. */
export type SceneRole = (typeof SCENE_ROLES)[number]

/** The most scenes one script holds. */
export const SCRIPT_SCENES_MAX = 12

/** The longest heading of a scene: its one short line in the storyboard (it is not drawn on the clip). */
export const CAPTION_MAX = 160

/** The longest words a scene's voice says. */
export const VOICEOVER_MAX = 420

/** The longest description of what a scene shows. */
export const VISUAL_MAX = 240

/** One scene of a script: its role, its heading, the words the voice says and what the clip shows. */
export type ScriptScene = {
    /** What the scene does in the story: hook, body or call to action. */
    readonly role: SceneRole
    /** The short caption drawn on the scene. */
    readonly caption: string
    /** The words read aloud over the scene. */
    readonly voiceover: string
    /** What the scene shows. */
    readonly visual: string
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Text with its runs of white space folded to one space, trimmed and cut to `max`. */
const clip = (value: unknown, max: number): string =>
    typeof value === "string" ? value.replaceAll(/\s+/gu, " ").trim().slice(0, max) : ""

/** The role a stored value names; `body` for anything else. */
const roleOf = (value: unknown): SceneRole => SCENE_ROLES.find((role) => role === value) ?? "body"

/**
 * Whatever is stored or answered as clean scenes: at most `SCRIPT_SCENES_MAX`, every text bounded, a scene with neither heading nor
 * voiceover dropped. Never throws.
 */
export const readScript = (raw: unknown): ReadonlyArray<ScriptScene> => {
    if (!Array.isArray(raw)) return []
    return raw.slice(0, SCRIPT_SCENES_MAX).flatMap((entry: unknown): ReadonlyArray<ScriptScene> => {
        if (!isObject(entry)) return []
        const caption = clip(entry["caption"], CAPTION_MAX)
        const voiceover = clip(entry["voiceover"], VOICEOVER_MAX)
        if (caption === "" && voiceover === "") return []
        return [{ role: roleOf(entry["role"]), caption, voiceover, visual: clip(entry["visual"], VISUAL_MAX) }]
    })
}

/** The words the one voice track says: every scene's voiceover in order, a scene with none left out. */
export const voiceTextOf = (scenes: ReadonlyArray<ScriptScene>): string =>
    scenes
        .map((scene) => scene.voiceover)
        .filter((voiceover) => voiceover !== "")
        .join(" ")

/** The clip length of each scene, in order. */
export const clipPlanOf = (scenes: ReadonlyArray<ScriptScene>): ReadonlyArray<ClipSeconds> =>
    scenes.map((scene) => clipSecondsOf(scene.voiceover))

/**
 * What the video generation tool is asked to show for one scene: the picture the script describes, else its heading, else what its
 * voice says (a read scene has one of the two words).
 */
export const scenePromptOf = (scene: ScriptScene): string =>
    [scene.visual, scene.caption, scene.voiceover].find((text) => text !== "") ?? ""
