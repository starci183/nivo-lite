import type { Aspect } from "./video.constants"
import type { Goal, GoalTemplate } from "./video.types"

const GOAL_KEYS: ReadonlyArray<Goal> = ["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"]

/** The goal templates, in display order; their names and help lines are the `video.goal_<goal>` catalog entries. */
export const GOAL_TEMPLATES: ReadonlyArray<GoalTemplate> = [
    { goal: "service", default_seconds: 30, default_aspect: "9:16", music: "calm-glow" },
    { goal: "offer", default_seconds: 20, default_aspect: "9:16", music: "bold-beat" },
    { goal: "testimonial", default_seconds: 30, default_aspect: "9:16", music: "sunny-pop" },
    { goal: "behind_scenes", default_seconds: 30, default_aspect: "9:16", music: "sunny-pop" },
    { goal: "hiring", default_seconds: 30, default_aspect: "9:16", music: "calm-glow" },
    { goal: "custom", default_seconds: 30, default_aspect: "9:16", music: "sunny-pop" },
]

/** Whether a value is one of the goals. */
export const isGoal = (value: unknown): value is Goal => GOAL_KEYS.some((key) => key === value)

/** The template of a goal; the custom one when the goal is unknown. */
export const goalTemplateOf = (goal: Goal): GoalTemplate =>
    GOAL_TEMPLATES.find((template) => template.goal === goal) ?? GOAL_TEMPLATES[GOAL_TEMPLATES.length - 1]

/** The catalog key of a goal's name. */
export const goalLabelKey = (goal: Goal): string => `goal_${goal}`

/** The catalog key of a goal's help line. */
export const goalHintKey = (goal: Goal): string => `goal_${goal}_hint`

/** The catalog key of a frame shape label. */
export const aspectKey = (aspect: Aspect): string => `aspect_${aspect.replace(":", "x")}`
