import behindScenes from "../../../resources/video/templates/goals/behind_scenes.json"
import custom from "../../../resources/video/templates/goals/custom.json"
import hiring from "../../../resources/video/templates/goals/hiring.json"
import offer from "../../../resources/video/templates/goals/offer.json"
import service from "../../../resources/video/templates/goals/service.json"
import testimonial from "../../../resources/video/templates/goals/testimonial.json"
import { ASPECTS } from "./video.constants"
import type { Aspect } from "./video.constants"
import { isRecord } from "./video.script"
import type { Goal, GoalTemplate, LocalText, SceneRole, TemplateScene } from "./video.types"

const GOAL_KEYS: ReadonlyArray<Goal> = ["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"]
const ROLE_KEYS: ReadonlyArray<SceneRole> = ["hook", "body", "cta"]

const textOf = (raw: unknown): LocalText => {
    const source = isRecord(raw) ? raw : {}
    return {
        vi: typeof source.vi === "string" ? source.vi : "",
        en: typeof source.en === "string" ? source.en : "",
    }
}

const sceneOf = (raw: unknown): ReadonlyArray<TemplateScene> => {
    const source = isRecord(raw) ? raw : {}
    const role = ROLE_KEYS.find((key) => key === source.role)
    return role === undefined || typeof source.brief !== "string" ? [] : [{ role, brief: source.brief }]
}

const templateOfRaw = (raw: unknown): ReadonlyArray<GoalTemplate> => {
    const source = isRecord(raw) ? raw : {}
    const goal = GOAL_KEYS.find((key) => key === source.goal)
    const aspect: Aspect = ASPECTS.find((key) => key === source.default_aspect) ?? "9:16"
    if (goal === undefined) return []
    return [
        {
            goal,
            order: typeof source.order === "number" ? source.order : 0,
            label: textOf(source.label),
            hint: textOf(source.hint),
            default_seconds: typeof source.default_seconds === "number" ? source.default_seconds : 30,
            default_aspect: aspect,
            music: typeof source.music === "string" ? source.music : null,
            scenes: Array.isArray(source.scenes) ? source.scenes.flatMap(sceneOf) : [],
        },
    ]
}

/** The goal templates, in display order (data: resources/video/templates/goals/*.json). */
export const GOAL_TEMPLATES: ReadonlyArray<GoalTemplate> = [service, offer, testimonial, behindScenes, hiring, custom]
    .flatMap(templateOfRaw)
    .sort((a, b) => a.order - b.order)

/** Whether a value is one of the goals. */
export const isGoal = (value: unknown): value is Goal => GOAL_KEYS.some((key) => key === value)

/** The template of a goal; the custom one when the goal is unknown. */
export const goalTemplateOf = (goal: Goal): GoalTemplate =>
    GOAL_TEMPLATES.find((template) => template.goal === goal) ?? GOAL_TEMPLATES[GOAL_TEMPLATES.length - 1]

/** The catalog key of a frame shape label. */
export const aspectKey = (aspect: Aspect): string => `aspect_${aspect.replace(":", "x")}`
