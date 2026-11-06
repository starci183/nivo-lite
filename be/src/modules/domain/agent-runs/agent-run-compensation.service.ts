import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { ADVANCE_MAX_STEPS, HANDLER_THREW } from "./policies/agent-runs.policy"
import type { StepView } from "./agent-runs.contracts"
import type { RunRef } from "./agent-runs-engine.contracts"

/** The code of a run whose undo finished: the failure that started it stays on the run. */
const COMPENSATED = "compensated"

@Injectable()
/**
 * Undoes the done steps of a run that failed before any pivot, last first. Each undo is claimed under a fence and committed under it, so
 * two workers never undo one step twice; a failed undo is tried again after a pause, and past its tries the run goes to a person. When the
 * last step is undone the run is `compensated` and a person is told, because the customer's message must not end unanswered.
 */
export class AgentRunCompensationService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly ledger: AgentStepLedgerService,
        private readonly handlers: AgentRunHandlersService,
        private readonly store: AgentRunStoreService,
        private readonly deadLetter: AgentRunDeadLetterService,
    ) {}

    /** Undoes what is left to undo in the run, in reverse order, until none is left, one fails, or the claim is another worker's. */
    run(ref: RunRef, signal: AbortSignal): Promise<void> {
        return this.undoNext(ref, signal, ADVANCE_MAX_STEPS)
    }

    private async undoNext(ref: RunRef, signal: AbortSignal, left: number): Promise<void> {
        if (left <= 0 || signal.aborted) return
        const claim = await this.ledger.claimCompensation(ref)
        if (claim.kind === "finished") {
            const run = await this.store.runById(ref.workspaceId, ref.runId)
            await this.deadLetter.tell(ref.workspaceId, ref.runId, null, run?.errorCode ?? COMPENSATED)
            return
        }
        if (claim.kind !== "claimed") return
        const failure = await this.undo(claim.step, signal)
        const committed = await this.ledger.commitCompensation(claim.step, failure === null, failure)
        if (committed === "dead") {
            await this.deadLetter.tell(ref.workspaceId, ref.runId, claim.step.stepKey, "compensation_failed")
            return
        }
        if (committed === "ok" && failure === null) await this.undoNext(ref, signal, left - 1)
    }

    /** Runs the undo; answers null when it worked, else the code of why not. */
    private async undo(step: StepView, signal: AbortSignal): Promise<string | null> {
        const kind = step.effect.kind === "compensable" ? step.effect.compensation : step.kind
        const handler = this.handlers.of(kind)
        if (handler?.compensate === undefined) {
            this.logger.error(AgentRunsLogEvent.CompensationFailed, new Error("no compensation"), {
                runId: step.runId,
                stepKey: step.stepKey,
                kind,
            })
            return "no_compensation"
        }
        try {
            await handler.compensate(step, signal)
            return null
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.CompensationFailed, cause, { runId: step.runId, stepKey: step.stepKey })
            return HANDLER_THREW
        }
    }
}
