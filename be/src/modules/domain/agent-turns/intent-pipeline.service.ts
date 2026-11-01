import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { readResultSchema, turnRowSchema } from "./intent-step.schema"
import { INTENT_STEP_KIND, TURN_TEXT_MAX, doorNodeOf } from "./intent-turn.policy"
import { IntentTurnService } from "./intent-turn.service"
import { wakeRowOf } from "./intent-wake.policy"
import type {
    IntentDoorExtra,
    IntentDoorResult,
    IntentPlan,
    IntentRead,
    IntentReadingRow,
} from "./agent-turns.contracts"

/** The step key of each stage: one per run, since a wake has one turn. */
const STEP_KEY = { turn: "turn", read: "read_result", door: "door" } as const

@Injectable()
/**
 * The stages of a pipeline turn as the steps of its run: the model's text (`turn`), the reading of it against the contracts
 * (`read_result`) and the door that acts. Each stage is a row the engine commits, so a replay of the wake answers the stored result of a
 * stage that is done and never repeats it. The run is opened with the wake's own context, so a person has the trigger intact if it dies.
 */
export class IntentPipelineService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly runs: AgentRunsService,
        private readonly intents: IntentTurnService,
    ) {}

    /** Opens the one run of this wake; opening it again is a no-op. */
    open(turn: AgentTurnView, plan: IntentPlan): Promise<void> {
        return this.entityManager.transaction(async (tx) => {
            await this.runs.open(tx, {
                workspaceId: turn.workspaceId,
                agentId: turn.agentId,
                wakeId: turn.wakeId,
                trigger: plan.trigger,
                versionId: plan.versionId,
                context: { ...turn.context },
            })
        })
    }

    /** Keeps the model's text on the run and reads it. A row that cannot be read back is the safe road, never a thrown turn. */
    async read(turn: AgentTurnView, plan: IntentPlan, text: string, signal: AbortSignal): Promise<IntentRead> {
        await this.open(turn, plan)
        const keys = await this.intents.nodeKeysOf(turn.workspaceId, turn.agentId)
        const kept = turnRowSchema.safeParse(
            await this.runs.runInline(
                turn.wakeId,
                {
                    stepKey: STEP_KEY.turn,
                    nodeKey: keys.turn,
                    kind: INTENT_STEP_KIND.turn,
                    effect: { kind: "read" },
                    input: { text: text.slice(0, TURN_TEXT_MAX) },
                },
                signal,
            ),
        )
        const read = readResultSchema.safeParse(
            await this.runs.runInline(
                turn.wakeId,
                {
                    stepKey: STEP_KEY.read,
                    nodeKey: keys.turn,
                    kind: INTENT_STEP_KIND.readResult,
                    effect: { kind: "read" },
                    input: { plan, text: kept.success ? kept.data.text : "" },
                },
                signal,
            ),
        )
        if (read.success) return read.data
        const reading: IntentReadingRow = {
            kind: "safe",
            cause: "invalid_output",
            detail: "unreadable_step",
            intent: null,
            gap: null,
            draft: "",
        }
        return {
            reading,
            trace: {
                versionId: plan.versionId,
                trigger: plan.trigger,
                audience: plan.audience,
                offered: plan.contracts.map((contract) => contract.intent),
                intent: null,
                result: "invalid_output",
                detail: reading.detail,
                dropped: [],
            },
        }
    }

    /** Runs the door of the trigger for the reading and answers what it did. The door acts in the world, so it is a pivot. */
    async door(
        turn: AgentTurnView,
        kind: string,
        read: IntentRead,
        signal: AbortSignal,
        extra: IntentDoorExtra = {},
    ): Promise<IntentDoorResult> {
        const keys = await this.intents.nodeKeysOf(turn.workspaceId, turn.agentId)
        return this.runs.runInline(
            turn.wakeId,
            {
                stepKey: STEP_KEY.door,
                nodeKey: doorNodeOf(keys, read.reading),
                kind,
                effect: { kind: "pivot" },
                input: {
                    wake: wakeRowOf(turn),
                    reading: read.reading,
                    trace: read.trace,
                    ...extra,
                },
            },
            signal,
        )
    }
}
