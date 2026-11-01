import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isDomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { DEFAULT_MAX_ATTEMPTS, HANDLER_THREW, NO_HANDLER } from "./policies/agent-runs.policy"
import { routeFailure } from "./policies/failure-route.policy"
import type { StepAnswer, StepView } from "./agent-runs.contracts"
import type { StepEnd } from "./agent-runs-engine.contracts"

@Injectable()
/**
 * Runs one claimed step: the handler does the business, this class commits the answer. A done step is stored with the steps that follow in
 * one transaction. A failed try goes to the failure policy in the same transaction that records it: it is tried again after a backoff,
 * undone in reverse order, or given to a person; a step that stopped the run is told to a person after the commit.
 */
export class AgentRunStepsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly handlers: AgentRunHandlersService,
        private readonly ledger: AgentStepLedgerService,
        private readonly store: AgentRunStoreService,
        private readonly compensation: AgentRunCompensationService,
        private readonly deadLetter: AgentRunDeadLetterService,
    ) {}

    /** Runs the claimed step through its handler and commits what it answered, under the fence of the claim. */
    async execute(step: StepView, signal: AbortSignal): Promise<StepEnd> {
        const answer = await this.answerOf(step, signal)
        if (answer.kind === "retry" || answer.kind === "failed") {
            return this.fail(step, answer.code, answer.kind === "retry", signal)
        }
        const committed = await this.ledger.commit(
            step,
            answer.kind === "done"
                ? { kind: "done", result: answer.result, next: answer.next }
                : { kind: "wait", workItemId: answer.workItemId, deadlineAt: answer.deadlineAt },
        )
        if (committed === "fenced") return this.fenced(step)
        return answer.kind === "done"
            ? { kind: "done", result: answer.result }
            : { kind: "wait", workItemId: answer.workItemId }
    }

    /**
     * Records a failed try and routes it. `retryable` says the handler asked for another try. The record and the route commit together; a
     * fence that moved on changes nothing. After the commit a run that went back is undone, and one that went to a person is told.
     */
    async fail(step: StepView, code: string, retryable: boolean, signal: AbortSignal): Promise<StepEnd> {
        const routed = await this.entityManager.transaction(async (tx) => {
            const steps = await this.store.routeStepsOf(tx, step.runId)
            const route = routeFailure({ code, retryable, attempt: step.attempt, maxAttempts: step.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, steps })
            if (route.kind === "retry") {
                const retried = await this.ledger.commitIn(tx, step, { kind: "retry", code, afterMs: route.afterMs })
                return retried === "ok" ? route : null
            }
            if ((await this.ledger.commitIn(tx, step, { kind: "failed", code })) === "fenced") return null
            const compensate = route.kind === "compensate" ? route.stepKeys : []
            const to = route.kind === "compensate" ? "compensating" : "dead"
            await this.store.route(tx, step.runId, { from: "running", to, code, compensate })
            return route
        })
        if (routed === null) return this.fenced(step)
        if (routed.kind === "retry") {
            this.logger.warn(AgentRunsLogEvent.StepRetry, { runId: step.runId, stepKey: step.stepKey, code })
        } else {
            this.logger.warn(AgentRunsLogEvent.StepFailed, { runId: step.runId, stepKey: step.stepKey, code })
        }
        if (routed.kind === "compensate") await this.compensation.run(step.runId, signal)
        if (routed.kind === "person") await this.deadLetter.tell(step.runId, step.stepKey, code)
        return { kind: "failed", code }
    }

    private fenced(step: StepView): StepEnd {
        this.logger.warn(AgentRunsLogEvent.StepFenced, { runId: step.runId, stepKey: step.stepKey })
        return { kind: "fenced" }
    }

    /** What the handler answered; a throw is a try that failed and may be tried again, a kind nobody handles is a failure. */
    private async answerOf(step: StepView, signal: AbortSignal): Promise<StepAnswer> {
        const handler = this.handlers.of(step.kind)
        if (handler === undefined) {
            this.logger.error(AgentRunsLogEvent.NoHandler, new Error("no handler"), {
                runId: step.runId,
                kind: step.kind,
            })
            return { kind: "failed", code: NO_HANDLER }
        }
        try {
            return await handler.run(step, signal)
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.HandlerThrew, cause, { runId: step.runId, stepKey: step.stepKey })
            return { kind: "retry", code: isDomainError(cause) ? cause.code : HANDLER_THREW }
        }
    }
}
