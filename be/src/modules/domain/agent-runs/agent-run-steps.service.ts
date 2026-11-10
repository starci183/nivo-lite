import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isDomainError } from "@modules/platform/errors"
import type { ErrorParams } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { classifyFailure, startLocalInterval } from "@modules/platform/queue"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunResumeService } from "./agent-run-resume.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { DEFAULT_MAX_ATTEMPTS, HANDLER_THREW, NO_HANDLER, stepHeartbeatMsOf } from "./policies/agent-runs.policy"
import { routeFailure, triesLeft } from "./policies/failure-route.policy"
import type { OptionalStepPassOver, StepAnswer, StepPassOver, StepView } from "./agent-runs.contracts"
import type { StepEnd } from "./agent-runs-engine.contracts"

/** The claim a running step holds: its fence as the last renewal left it, whether it was lost, and the renewal still in flight. */
interface HeldClaim {
    /** The fence of the claim now. */
    fence: number
    /** True once a renewal found the claim taken by another try. */
    lost: boolean
    /** The renewal in flight, so a commit never races it. */
    renewing: Promise<void>
}

@Injectable()
/**
 * Runs one claimed step: the handler does the business, this class commits the answer. A done step is stored with the steps that follow in
 * one transaction. A failed try goes to the failure policy in the same transaction that records it: it is tried again after a backoff,
 * undone in reverse order, or given to a person; a step that stopped the run is told to a person after the commit. A side step (one that
 * only informs someone) that fails past its tries is recorded with its failure and the run goes on to the steps its handler names; a
 * person is told after the commit.
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
        private readonly resume: AgentRunResumeService,
    ) {}

    /**
     * Runs the claimed step through its handler and commits what it answered, under the fence of the claim. While the handler works
     * the claim is renewed (a heartbeat), so the step is never taken by a second try while this one is alive: a model call and its
     * retry may take longer than the step's deadline. A try whose claim was lost all the same (the worker stalled past it) stops:
     * its handler's signal is aborted, and it commits and reports nothing, since another try owns the step now.
     */
    async execute(claimed: StepView, signal: AbortSignal): Promise<StepEnd> {
        const held: HeldClaim = { fence: claimed.fence, lost: false, renewing: Promise.resolve() }
        const lost = new AbortController()
        const heartbeat = startLocalInterval(stepHeartbeatMsOf(claimed.deadlineMs), () => {
            held.renewing = held.renewing.then(() => this.renew(claimed, held, lost))
        })
        let answer: StepAnswer
        try {
            answer = await this.answerOf(claimed, AbortSignal.any([signal, lost.signal]))
        } finally {
            heartbeat.cancel()
            await held.renewing
        }
        if (held.lost) return this.fenced(claimed)
        const step: StepView = { ...claimed, fence: held.fence }
        if (answer.kind === "retry" || answer.kind === "failed") {
            return this.fail(
                step,
                answer.code,
                answer.kind === "retry",
                signal,
                answer.kind === "failed",
                answer.params,
            )
        }
        const committed = await this.ledger.commit(
            step,
            answer.kind === "done"
                ? {
                      kind: "done",
                      result: answer.result,
                      next: answer.next,
                      ...(answer.continues === true ? { continues: true } : {}),
                  }
                : { kind: "wait", workItemId: answer.workItemId, deadlineAt: answer.deadlineAt },
        )
        if (committed === "fenced") return this.fenced(step)
        return answer.kind === "done"
            ? { kind: "done", result: answer.result }
            : { kind: "wait", workItemId: answer.workItemId }
    }

    /**
     * Records a failed try and routes it. `retryable` says the handler asked for another try. The record and the route commit together; a
     * fence that moved on changes nothing. After the commit a run that went back is undone, and one that went to a person is told. `park` says
     * no other try can cure it (an invalid input, a bug, a handler nobody registered): the run waits for a fix with its done steps kept.
     * A side step whose handler can go past it is committed done with its failure in the result and the steps that follow.
     */
    async fail(
        step: StepView,
        code: string,
        retryable: boolean,
        signal: AbortSignal,
        park: boolean = false,
        params: ErrorParams = {},
    ): Promise<StepEnd> {
        const tries = {
            code,
            retryable,
            attempt: step.attempt,
            maxAttempts: step.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            park,
        }
        const pass = triesLeft(tries) ? null : await this.passOverOf(step, code)
        const routed = await this.entityManager.transaction(async (tx) => {
            const steps = await this.store.routeStepsOf(step.workspaceId, step.runId, tx)
            const route = routeFailure({ ...tries, steps, sideStep: pass !== null })
            if (route.kind === "continue") {
                if (pass === null) return null
                const passed = await this.ledger.commitIn(tx, step, {
                    kind: "done",
                    result: pass.result,
                    next: pass.next,
                })
                return passed === "ok" ? route : null
            }
            if (route.kind === "retry") {
                const retried = await this.ledger.commitIn(tx, step, { kind: "retry", code, afterMs: route.afterMs })
                return retried === "ok" ? route : null
            }
            if ((await this.ledger.commitIn(tx, step, { kind: "failed", code })) === "fenced") return null
            const compensate = route.kind === "compensate" ? route.stepKeys : []
            const to = route.kind === "compensate" ? "compensating" : "parked"
            await this.store.route(step.workspaceId, step.runId, { from: "running", to, code, compensate }, tx)
            return route
        })
        if (routed === null) return this.fenced(step)
        if (routed.kind === "continue" && pass !== null) return this.passedOver(step, code, params, pass)
        if (routed.kind === "retry") {
            this.logger.warn(AgentRunsLogEvent.StepRetry, { runId: step.runId, stepKey: step.stepKey, code, params })
        } else {
            this.logger.warn(AgentRunsLogEvent.StepFailed, { runId: step.runId, stepKey: step.stepKey, code, params })
        }
        if (routed.kind === "compensate") await this.compensation.run(step, signal)
        if (routed.kind === "person") {
            await this.resume.markParked(step.workspaceId, step.runId)
            this.logger.warn(AgentRunsLogEvent.RunParked, { runId: step.runId, stepKey: step.stepKey, code, params })
            await this.deadLetter.tell(step.workspaceId, step.runId, step.stepKey, code, params)
        }
        return { kind: "failed", code }
    }

    /** The handler's way past a side step that failed, or null when the step blocks the run or its handler could not say. */
    private async passOverOf(step: StepView, code: string): Promise<OptionalStepPassOver> {
        const handler = this.handlers.of(step.kind)
        if (handler?.passOver === undefined) return null
        try {
            return (await handler.passOver(step, code)) ?? null
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.PassOverFailed, cause, {
                runId: step.runId,
                stepKey: step.stepKey,
                code,
            })
            return null
        }
    }

    /** After the commit of a side step that was passed over: a person is told, and a failure to tell never stops the run. */
    private async passedOver(step: StepView, code: string, params: ErrorParams, pass: StepPassOver): Promise<StepEnd> {
        this.logger.warn(AgentRunsLogEvent.StepPassedOver, { runId: step.runId, stepKey: step.stepKey, code, params })
        try {
            await this.handlers.of(step.kind)?.sideFailed?.(step, code)
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.SideTellFailed, cause, {
                runId: step.runId,
                stepKey: step.stepKey,
                code,
            })
        }
        return { kind: "done", result: pass.result }
    }

    /** One beat: holds the claim for another deadline and keeps its new fence; a claim another try took is marked lost and the handler stopped. */
    private async renew(step: StepView, held: HeldClaim, lost: AbortController): Promise<void> {
        if (held.lost) return
        try {
            const fence = await this.ledger.renew({ ...step, fence: held.fence })
            if (fence !== null) {
                held.fence = fence
                return
            }
            held.lost = true
            this.logger.warn(AgentRunsLogEvent.StepClaimLost, { runId: step.runId, stepKey: step.stepKey })
            lost.abort()
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.StepRenewFailed, cause, { runId: step.runId, stepKey: step.stepKey })
        }
    }

    private fenced(step: StepView): StepEnd {
        this.logger.warn(AgentRunsLogEvent.StepFenced, { runId: step.runId, stepKey: step.stepKey })
        return { kind: "fenced" }
    }

    /** What the handler answered; a throw of the network or a deadline is tried again, any other throw and a kind nobody handles park the run. */
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
            const code = isDomainError(cause) ? cause.code : HANDLER_THREW
            const params = isDomainError(cause) ? cause.params : {}
            this.logger.error(AgentRunsLogEvent.HandlerThrew, cause, {
                runId: step.runId,
                stepKey: step.stepKey,
                code,
                params,
            })
            return { kind: classifyFailure(cause) === "transient" ? "retry" : "failed", code, params }
        }
    }
}
