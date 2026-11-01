import { IntentRegistryService, requestFrameOf } from "@modules/domain/intent-contracts"
import type { IntentCheck, IntentDomain, IntentFrame, IntentResultSchema } from "@modules/domain/intent-contracts"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const MEMBERS: ReadonlySet<string> = new Set(["reply", "lead", "order"])

/** A result with a reply and two optional members; any other member refuses it. */
const ANSWER_SCHEMA: IntentResultSchema = {
    safeParse: (value) => {
        if (!isRecord(value) || typeof value.reply !== "string") return { success: false }
        if (Object.keys(value).some((member) => !MEMBERS.has(member))) return { success: false }
        return { success: true, data: { reply: value.reply, lead: value.lead ?? null, order: value.order ?? null } }
    },
}

const present = (value: unknown): boolean => typeof value === "string" && value.trim() !== ""

const CHECKS: Readonly<Record<string, IntentCheck>> = {
    reply_present: ({ result }) => present(result.reply),
    lead_complete: ({ result }) => !isRecord(result.lead) || present(result.lead.need),
}

const answerFrame = (intent: string, owns: ReadonlyArray<string>, ownTurn = false, answers = false): IntentFrame => ({
    intent,
    triggers: ["customer_message"],
    ownTurn,
    answers,
    taskKey: `task.${intent}`,
    limitKeys: { outsider: ["limit.style", "limit.lead", "limit.order"] },
    result: "test_answer",
    owns,
    limitMembers: { "limit.lead": "lead", "limit.order": "order" },
    checks: ["reply_present", "lead_complete"],
})

/** A small domain for the specs of the registry and of what reads it: an answering intent, two that own a member, and one that runs alone. */
export const TEST_DOMAIN: IntentDomain = {
    frames: [
        answerFrame("reply_customer", [], false, true),
        answerFrame("handoff_lead", ["lead"]),
        answerFrame("confirm_order", ["order"]),
        answerFrame("gateway_call", [], true),
        requestFrameOf("gateway_call", true),
    ],
    results: { test_answer: ANSWER_SCHEMA },
    checks: CHECKS,
}

/** A registry holding the test domain. */
export const testRegistry = (): IntentRegistryService => {
    const registry = new IntentRegistryService()
    registry.add(TEST_DOMAIN)
    return registry
}
