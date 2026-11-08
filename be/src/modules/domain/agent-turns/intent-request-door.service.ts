import { Injectable } from "@nestjs/common"
import type { StepAnswer, StepView } from "@modules/domain/agent-runs"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InternalProposalSettlerService } from "./internal-proposal-settler.service"
import { IntentSplitService } from "./intent-split.service"
import { requestDoorInputSchema } from "./intent-step.schema"
import { requestProposalTextOf } from "./intent-request.policy"
import { IntentTurnService } from "./intent-turn.service"
import { wakeRefOf } from "./intent-wake.policy"
import type { RequestDoorInput } from "./agent-turns.contracts"

/** Why a step cannot run: its row does not hold what the door needs. */
const INVALID_INPUT = "invalid_step_input"

@Injectable()
/**
 * The request door of a contract turn, run from its persisted row alone. A picked intent is the request the contract's result holds, and
 * it goes through the common settler: the authority gate decides, and a source without a writable member always asks. The safe road is
 * a plain line with no action and no task, and a model that found no intent for the work raises the gap. A split writes the follow-up wake
 * and settles nothing. The surface that has a reply channel reads the reply this step stores.
 */
export class IntentRequestDoorService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly settler: InternalProposalSettlerService,
        private readonly intents: IntentTurnService,
        private readonly split: IntentSplitService,
    ) {}

    /** Applies one contract request through the authoritative settler, or refuses an unreadable row. */
    async apply(step: StepView): Promise<StepAnswer> {
        const parsed = requestDoorInputSchema.safeParse(step.input)
        if (!parsed.success) return { kind: "failed", code: INVALID_INPUT }
        const input = parsed.data
        if (input.reading.kind === "split") {
            const fired = await this.split.fire(input.wake, input.reading.contract.intent)
            return { kind: "done", result: { split: true, fired }, next: [] }
        }
        await this.raiseGap(input)
        const text =
            input.reading.kind === "picked"
                ? requestProposalTextOf(
                      input.reading.contract.result,
                      input.reading.resultText,
                      input.reading.contract.intent,
                  )
                : this.catalog.get("agentTurns.safeRoad", {}, input.settle.locale)
        if (text === null) return { kind: "failed", code: INVALID_INPUT }
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
    private async raiseGap(input: RequestDoorInput): Promise<void> {
        const { reading, trace, wake } = input
        if (reading.kind !== "safe" || reading.cause !== "no_intent" || reading.gap === null) return
        await this.intents.raiseGap({
            ...reading.gap,
            workspaceId: wake.workspaceId,
            agentId: wake.agentId,
            versionId: trace.versionId,
            trigger: trace.trigger,
        })
    }
}
