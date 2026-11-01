import type { IntentFrame, IntentTrigger } from "./intent-contracts.contracts"
import type { FrameAction, OptionalIntentFrame } from "./intent-policies.contracts"

const REQUEST_LIMITS: ReadonlyArray<string> = [
    "intentContracts.limit.reply_internal",
    "intentContracts.limit.tasks",
    "intentContracts.limit.task_title",
    "intentContracts.limit.request_only",
]

/** The key of the result a request is read by, and of the checks it passes. */
export const REQUEST_RESULT = "agent_request"
export const OWN_TURN_RESULT = "own_turn_pick"

/** Any action asked for by a tag: a request the system decides on, never something done. A domain may say the intent runs in a turn of its own. */
export const requestFrameOf = (intent: string, ownTurn: boolean): IntentFrame => ({
    intent,
    triggers: ["tag"],
    ownTurn,
    answers: false,
    taskKey: "intentContracts.task.agent_request",
    limitKeys: { manager: REQUEST_LIMITS, member: ["intentContracts.limit.staff"] },
    result: REQUEST_RESULT,
    owns: [],
    limitMembers: {},
    checks: ["action_is_intent", "action_has_summary"],
})

/**
 * The frame an intent runs under for a trigger, or null when it has none: the frame a domain registered for that trigger when the
 * catalogue holds the action, else, for a tag, the generic request of any catalogue action (which runs in a turn of its own when the
 * catalogue says an amount limits it). An intent that is not in the catalogue has no frame at all.
 */
export const frameOfIntent = (
    frames: ReadonlyArray<IntentFrame>,
    intent: string,
    actions: ReadonlyArray<FrameAction>,
    trigger: IntentTrigger,
): OptionalIntentFrame => {
    const action = actions.find((entry) => entry.action === intent)
    if (action === undefined) return null
    const own = frames.find((frame) => frame.intent === intent && frame.triggers.includes(trigger))
    if (own !== undefined) return own
    return trigger === "tag" ? requestFrameOf(intent, action.amountLimit) : null
}

/** True when some frame of a domain answers the audience of the trigger, so a turn of that trigger must have one to pick from. */
export const answerNeeded = (frames: ReadonlyArray<IntentFrame>, trigger: IntentTrigger): boolean =>
    frames.some((frame) => frame.answers && frame.triggers.includes(trigger))
