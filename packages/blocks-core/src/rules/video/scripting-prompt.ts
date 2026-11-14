import { scriptRoleAt } from "./scripting"
import { VIDEO_GOAL_OUTLINES } from "./scripting-outlines"
import type { VideoAspect, VideoGoal } from "./spec"

/** The fewest scenes a script is asked for. */
export const SCRIPT_SCENES_ASKED_MIN = 3

/** The most scenes a script is asked for. */
export const SCRIPT_SCENES_ASKED_MAX = 8

/** What a script is written for: the shop, the goal, the shape, the length and what the owner wants stressed. */
export type ScriptAsk = {
    /** The name of the shop the video is made for. */
    readonly shop: string
    /** What the video is for. */
    readonly goal: VideoGoal
    /** The shape of the video. */
    readonly aspect: VideoAspect
    /** How long the whole video should run. */
    readonly targetSeconds: number
    /** The owner's own words about what the video should show. */
    readonly brief: string
}

/** How many scenes a video of `targetSeconds` is asked for: one about every six seconds, three to eight. */
export const sceneCountOf = (targetSeconds: number): number =>
    Math.min(SCRIPT_SCENES_ASKED_MAX, Math.max(SCRIPT_SCENES_ASKED_MIN, Math.round(targetSeconds / 6)))

/** About how many characters each scene's voice may say so the video keeps its length (14 a second, a breath per scene). */
export const voiceCharsOf = (targetSeconds: number, count: number): number =>
    Math.max(40, Math.round((targetSeconds / count - 0.8) * 14))

/** The numbered outline of `count` scenes for a goal: its opening, its body points in turn, and its close. */
export const outlineOf = (goal: VideoGoal, count: number): string => {
    const steps = VIDEO_GOAL_OUTLINES[goal].steps
    const bodies = steps.filter((step) => step.role === "body")
    return Array.from({ length: count }, (_, index) => {
        const role = scriptRoleAt(index, count)
        const brief =
            role === "body"
                ? bodies[(index - 1) % Math.max(1, bodies.length)]?.brief
                : steps.find((step) => step.role === role)?.brief
        return `${String(index + 1)}. ${role.toUpperCase()}: ${brief ?? ""}`
    }).join("\n")
}

/**
 * The words a script is asked in: the shop, the goal and its hint, the format, the scene count with each voice's length, the outline and
 * what the owner wants stressed. The shop's facts are read by the writer itself (the brain), never pasted here.
 */
export const scriptAskText = (ask: ScriptAsk): string => {
    const outline = VIDEO_GOAL_OUTLINES[ask.goal]
    const count = sceneCountOf(ask.targetSeconds)
    const voiceChars = voiceCharsOf(ask.targetSeconds, count)
    return [
        `SHOP: ${ask.shop}`,
        `GOAL: ${outline.label}. ${outline.hint}`,
        `FORMAT: ${ask.aspect}, about ${String(ask.targetSeconds)} seconds in total.`,
        `SCENES: exactly ${String(count)}. Each voiceover about ${String(voiceChars)} characters, never above ${String(voiceChars + 30)}.`,
        `OUTLINE:\n${outlineOf(ask.goal, count)}`,
        ask.brief.trim() === "" ? "" : `THE OWNER WANTS TO STRESS: ${ask.brief.trim()}`,
    ]
        .filter((line) => line !== "")
        .join("\n\n")
}
