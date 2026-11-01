import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepAnswer, StepView } from "@modules/domain/agent-runs"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InternalProposalSettlerService } from "./internal-proposal-settler.service"
import { IntentSplitService } from "./intent-split.service"
import { tagDoorInputSchema } from "./intent-step.schema"
import { INTENT_STEP_KIND } from "./intent-turn.policy"
import { IntentTurnService } from "./intent-turn.service"
import { wakeRefOf } from "./intent-wake.policy"
import type { TagDoorInput } from "./agent-turns.contracts"

/** Why a step cannot run: its row does not hold what the door needs. */
const INVALID_INPUT = "invalid_step_input"

@Injectable()
/**
 * The door of a tag turn on the contract pipeline, run from its row alone. A picked intent is the request the contract's result holds, and
 * it goes through the settler a tag always went through: the authority gate decides, and a staff tag still forces an ask. The safe road is
 * a plain line with no action and no task, and a model that found no intent for the work raises the gap. A split writes the follow-up wake
 * and settles nothing. What the colleague hears is said by the handler of the surface, from the reply this step stores.
 */
export class IntentTagDoorStepService implements OnModuleInit {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly handlers: AgentRunHandlersService,
        private readonly settler: InternalProposalSettlerService,
        private readonly intents: IntentTurnService,
        private readonly split: IntentSplitService,
    ) {}

    /** Registers the door with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add({ kind: INTENT_STEP_KIND.tagDoor, run: (step) => this.run(step) })
    }

    private async run(step: StepView): Promise<StepAnswer> {
        const parsed = tagDoorInputSchema.safeParse(step.input)
        if (!parsed.success) return { kind: "failed", code: INVALID_INPUT }
        const input = parsed.data
        if (input.reading.kind === "split") {
            const fired = await this.split.fire(input.wake, input.reading.contract.intent)
            return { kind: "done", result: { split: true, fired }, next: [] }
        }
        await this.raiseGap(input)
        const text =
            input.reading.kind === "picked"
                ? input.reading.resultText
                : this.catalog.get("agentTurns.safeRoad", {}, input.settle.locale)
        const { reply, needsHuman, reason, tasks, actions } = await this.settler.apply(
            wakeRefOf(input.wake),
            text,
            input.settle,
        )
        return {
            kind: "done",
            result: { split: false, settled: { reply, needsHuman, reason, tasks, actions } },
            next: [],
        }
    }

    /** A turn no intent fits raises what was asked as a gap of the module, once per question. */
    private async raiseGap(input: TagDoorInput): Promise<void> {
        const { reading, trace, wake, settle } = input
        if (reading.kind !== "safe" || reading.cause !== "no_intent" || reading.gap === null) return
        await this.intents.raiseGap(
            {
                ...reading.gap,
                workspaceId: wake.workspaceId,
                agentId: wake.agentId,
                versionId: trace.versionId,
                trigger: trace.trigger,
            },
            settle.module,
        )
    }
}
