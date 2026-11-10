import type { NodeAgentRequest, NodeContext } from "@nivo-lite/agent-sdk/node"
import type { z } from "zod"
import type { NodeLocale } from "../node-schema.types"
import { TOOL } from "../../vocabulary/tool-ids"
import type { CareKind } from "./care.policy"

/**
 * How every care agent writes to a customer, appended to its goal. Guidance, not code: whether and what to say is the agent's call from
 * the facts it is given.
 */
export const CARE_VOICE: string =
    "Write as the shop, warm and short, in the customer's language (`locale`: vi = Vietnamese, en = English). Send ONE message with at most " +
    "one question. Use only the facts you are given and what the tools answer: never promise a refund, a discount, a delivery day or anything " +
    "the facts do not hold, and never type an amount that is not in the facts. A send that answers `refused` did not reach the customer: " +
    "do not try another way, say so in your output."

/** The language a care agent writes in, as its input carries it. */
export interface CareVoiceInput {
    /** The customer's language. */
    readonly locale: NodeLocale
}

/** Runs the step's agent and answers its output; an agent that cannot complete ends the step confused, for the engine's AI core to take over. */
export const agentAnswer = async <S extends z.ZodType>(
    context: Pick<NodeContext, "agent" | "confused">,
    request: NodeAgentRequest<S>,
): Promise<z.output<S>> => {
    const decision = await context.agent.run(request)
    if (decision.kind === "confused") return context.confused(decision.confusion)
    return decision.value
}

/** What `rearm` names: the timer to move. */
export interface CareTimer {
    /** The care step. */
    readonly kind: CareKind
    /** The record it is about. */
    readonly ref: string
    /** Tells two steps of one kind on one record apart, or empty. */
    readonly suffix: string
    /** The moment the step is really due, an ISO instant. */
    readonly dueAt: string
}

/**
 * Arms (or moves) the timer of a care step: timing is logic, so the code of a care node arms it, never the agent. Arming again under the
 * same step and record moves the same task, so a timer that woke early waits for its real moment.
 */
export const arm = async (context: Pick<NodeContext, "effect">, timer: CareTimer): Promise<void> => {
    await context.effect(
        TOOL.careSchedule,
        { kind: timer.kind, ref: timer.ref, dueAt: timer.dueAt, ...(timer.suffix === "" ? {} : { suffix: timer.suffix }) },
        { dedupeKey: `care-arm:${timer.kind}:${timer.ref}:${timer.suffix}:${timer.dueAt}` },
    )
}
