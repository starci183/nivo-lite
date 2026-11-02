import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepAnswer, StepJson, StepView } from "@modules/domain/agent-runs"
import type { IntentReading } from "@modules/domain/intent-contracts"
import { readInputSchema, readResultSchema, turnRowSchema } from "./intent-step.schema"
import { INTENT_STEP_KIND, readingRowOf } from "./intent-turn.policy"
import { IntentTurnService } from "./intent-turn.service"
import type { IntentPlan } from "./agent-turns.contracts"

/** Why a step cannot run: its row does not hold what its kind needs. */
const INVALID_INPUT = "invalid_step_input"
/** Why a reading is the safe road: its result does not fit a row. */
const UNSTORABLE = "unstorable_reading"

@Injectable()
/**
 * The two steps of a pipeline turn every trigger shares. `turn` keeps the model's text on the run, so a replay never asks the model again.
 * `read_result` reads that text against the contracts the row carries and answers the reading and its trace. Both are reads: they change
 * nothing, and both run from their row alone, so the sweeper can take either one up after a crash. The doors that act are registered by
 * the capability that owns the trigger.
 */
export class IntentStepHandlersService implements OnModuleInit {
    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly intents: IntentTurnService,
    ) {}

    /** Registers both kinds with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add({ kind: INTENT_STEP_KIND.turn, run: (step) => Promise.resolve(this.turn(step)) })
        this.handlers.add({ kind: INTENT_STEP_KIND.readResult, run: (step) => Promise.resolve(this.read(step)) })
    }

    private turn(step: StepView): StepAnswer {
        const input = turnRowSchema.safeParse(step.input)
        if (!input.success) return { kind: "failed", code: INVALID_INPUT }
        return { kind: "done", result: { text: input.data.text }, next: [], continues: true }
    }

    private read(step: StepView): StepAnswer {
        const input = readInputSchema.safeParse(step.input)
        if (!input.success) return { kind: "failed", code: INVALID_INPUT }
        const { plan, text } = input.data
        const kept = this.keptReading(plan, this.intents.readingOf(text, plan))
        return { kind: "done", result: kept, next: [], continues: true }
    }

    /** The reading and its trace as the row keeps them; a reading the row cannot hold is the safe road, never a failed step. */
    private keptReading(plan: IntentPlan, reading: IntentReading): StepJson {
        const stored = readResultSchema.safeParse({
            reading: readingRowOf(reading),
            trace: this.intents.traceOf(plan, reading),
        })
        if (stored.success) return stored.data
        const unstorable: IntentReading = {
            kind: "safe",
            cause: "invalid_output",
            detail: UNSTORABLE,
            intent: null,
            gap: null,
            draft: "",
        }
        return { reading: unstorable, trace: this.intents.traceOf(plan, unstorable) }
    }
}
