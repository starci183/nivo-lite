import { approvalInputSchema } from "./output-steps.schema"
import { Injectable, type OnModuleInit } from "@nestjs/common"
import {
    AgentRunHandlersService,
    DECISION_ACTOR_UNKNOWN,
    type AgentStepHandler,
    type StepAnswer,
    type StepDecision,
    type StepView,
} from "@modules/domain/agent-runs"
import { APPROVAL_STEP_KIND, approvedInputOf, approvedOutputsOf, declinedReplyOf } from "./output-steps.policy"

/** Why the row cannot run. */
const INVALID_INPUT = "invalid_input"

@Injectable()
/**
 * The step a held call waits on: it holds the exact calls a person is asked about, and their answer writes the steps that run them inside
 * the decision's own transaction, so an approved call and its final reply cannot be lost between the click and the run. A person who says
 * no, or a wait that ran out, runs nothing: only the reply step follows, with the neutral line, and the result names who ended it.
 */
export class ApprovalStepHandlerService implements AgentStepHandler, OnModuleInit {
    /** The kind it runs. */
    readonly kind: "approval" = APPROVAL_STEP_KIND

    constructor(private readonly handlers: AgentRunHandlersService) {}

    /** Registers with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add(this)
    }

    /** Waits on the work item the row names. */
    run(step: StepView): Promise<StepAnswer> {
        const parsed = approvalInputSchema.safeParse(step.input)
        if (!parsed.success) return Promise.resolve({ kind: "failed", code: INVALID_INPUT })
        const { workItemId, deadlineAt } = parsed.data
        return Promise.resolve({ kind: "wait", workItemId, deadlineAt: new Date(deadlineAt) })
    }

    /** The steps that follow a person's answer. */
    onDecided(step: StepView, decision: StepDecision): StepAnswer {
        const parsed = approvalInputSchema.safeParse(step.input)
        if (!parsed.success) return { kind: "failed", code: INVALID_INPUT }
        const input = decision.approved ? approvedInputOf(parsed.data, decision.data) : parsed.data
        if (input === null) return { kind: "failed", code: INVALID_INPUT }
        if (decision.approved && decision.by === null) return { kind: "failed", code: DECISION_ACTOR_UNKNOWN }
        return {
            kind: "done",
            result: { approved: decision.approved, by: decision.by },
            next:
                decision.approved && decision.by !== null
                    ? approvedOutputsOf(input, decision.by)
                    : [declinedReplyOf(input)],
        }
    }
}
