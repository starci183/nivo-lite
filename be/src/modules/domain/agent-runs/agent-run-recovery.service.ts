import { Injectable } from "@nestjs/common"
import { CHAT_DELIVERY_UNKNOWN } from "@modules/domain/chat-records"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunParkStoreService } from "./agent-run-park-store.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { DECISION_ACTOR_UNKNOWN, PARK_MAX_RESUMES, TOOL_OUTCOME_UNKNOWN } from "./policies/agent-runs.policy"
import { RESUMABLE_RUN } from "./policies/run-status.policy"
import type { StepJson, StepView } from "./agent-runs.contracts"
import type { ResumeResult } from "./agent-runs-engine.contracts"

/**
 * The machine's tries a run held for its owner is marked with: the build pass and the sweep take only a parked run whose tries are below
 * their cap, so neither takes it again; a person's resume is never capped.
 */
export const OWNER_HELD_ATTEMPTS = 1_000_000

/** Why a run the owner gave up on was closed. */
export const RUN_ABANDONED = "run_abandoned"

/** The codes of a step whose effect may have happened: it is never run again by anything, only a person reconciles it. */
const OUTCOME_UNKNOWN: ReadonlySet<string> = new Set([
    TOOL_OUTCOME_UNKNOWN,
    CHAT_DELIVERY_UNKNOWN,
    DECISION_ACTOR_UNKNOWN,
])

/** The step a run stopped on, as a person who runs it again needs it: the step and its stored input. */
export interface HeldStep {
    /** The step. */
    readonly stepKey: string
    /** Its node. */
    readonly nodeKey: string
    /** The handler kind. */
    readonly kind: string
    /** Why it failed. */
    readonly errorCode: string | null
    /** Its stored input. */
    readonly input: StepJson
}

/** The step a run stopped on, or null when no step of it failed. */
export type OptionalHeldStep = HeldStep | null

/** What a retry adds to the failed step's input: the input as it stands in, the input to run with out. */
export type HeldInput = (current: StepJson) => Promise<StepJson>

/** A person's retry of a run held for them: who, why, and how the failed step's input is read afresh. */
export interface HeldRetry {
    /** The workspace. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
    /** A member id or a name. */
    readonly actor: string
    /** Why, in a few words. */
    readonly reason: string
    /** The failed step's input with what changed since it failed; absent keeps what the step's handler reads afresh. */
    readonly input?: HeldInput
}

/** How abandoning a held run ended. */
export type AbandonResult = "abandoned" | "not_held"

@Injectable()
/**
 * The run a person holds: one that failed for good and is now the owner's to retry or give up. Holding takes it off the machine's
 * resume passes; a retry puts it back on its failed step with the newest input, the way a person's resume does; abandoning closes it as
 * dead with why, so nothing runs it again. Every write is an engine update under the version read.
 */
export class AgentRunRecoveryService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly store: AgentRunStoreService,
        private readonly parks: AgentRunParkStoreService,
        private readonly handlers: AgentRunHandlersService,
    ) {}

    /** Takes a run that stopped on a failed step off the machine's resume passes; false when it is not such a run. */
    keep(workspaceId: string, runId: string): Promise<boolean> {
        return this.store.at(workspaceId, undefined, async (scoped) => {
            const held = await this.store.patchRunWith(scoped, runId, (run) =>
                RESUMABLE_RUN.includes(run.status) && run.resumeAttempts < OWNER_HELD_ATTEMPTS
                    ? { resumeAttempts: OWNER_HELD_ATTEMPTS }
                    : null,
            )
            return held !== null
        })
    }

    /** The step the run stopped on, with its stored input; null when no step of it failed. */
    async failedStepOf(workspaceId: string, runId: string): Promise<OptionalHeldStep> {
        const [views, steps] = await Promise.all([
            this.store.viewsOf(workspaceId, runId),
            this.store.stepsOf(workspaceId, runId),
        ])
        const failed = views.find((step) => step.status === "failed")
        if (failed === undefined) return null
        return heldStepOf(failed, steps.find((step) => step.stepKey === failed.stepKey)?.errorCode ?? null)
    }

    /**
     * Runs the held run again from its failed step for a person: the step's handler reads its input afresh, then `input` adds what changed
     * while it was held. A step whose outcome is unknown is never run again. The reset and the job that drives the run commit together.
     */
    async retry(request: HeldRetry): Promise<ResumeResult> {
        const views = await this.store.viewsOf(request.workspaceId, request.runId)
        const failed = views.find((step) => step.status === "failed")
        const code =
            failed === undefined ? null : (await this.failedStepOf(request.workspaceId, request.runId))?.errorCode
        if (code != null && OUTCOME_UNKNOWN.has(code)) return { kind: "outcome_unknown" }
        const refreshed = failed === undefined ? undefined : await this.handlers.of(failed.kind)?.refresh?.(failed)
        const current = refreshed ?? failed?.input
        const input = current === undefined || request.input === undefined ? refreshed : await request.input(current)
        const answer = await this.parks.resumeRun({
            workspaceId: request.workspaceId,
            runId: request.runId,
            actor: request.actor,
            reason: request.reason,
            input: input ?? undefined,
            auto: false,
            max: PARK_MAX_RESUMES,
            backoffSeconds: 0,
        })
        if (answer.kind === "resumed")
            return { kind: "resumed", stepKey: answer.stepKey, workspaceId: answer.workspaceId }
        return { kind: answer.kind === "superseded" ? "not_parked" : answer.kind }
    }

    /** Closes a held run as dead with why, for good: no pass and no person runs it again from here. */
    abandon(workspaceId: string, runId: string, actor: string): Promise<AbandonResult> {
        return this.store.at(workspaceId, undefined, async (scoped) => {
            const at = this.clock.now().toISOString()
            const closed = await this.store.patchRunWith(scoped, runId, (fresh) =>
                RESUMABLE_RUN.includes(fresh.status)
                    ? {
                          status: "dead",
                          error: { code: RUN_ABANDONED, by: actor },
                          endedAt: at,
                          resumeAttempts: OWNER_HELD_ATTEMPTS,
                      }
                    : null,
            )
            return closed === null ? "not_held" : "abandoned"
        })
    }
}

const heldStepOf = (step: StepView, errorCode: string | null): HeldStep => ({
    stepKey: step.stepKey,
    nodeKey: step.nodeKey,
    kind: step.kind,
    errorCode,
    input: step.input,
})
