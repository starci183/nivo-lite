import { Injectable, Optional } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { CHAT_DELIVERY_UNKNOWN } from "@modules/domain/chat-records"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunParkStoreService } from "./agent-run-park-store.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunWorkspacesService } from "./agent-run-workspaces.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { InjectAgentRunsOptions } from "./agent-runs.decorators"
import type { AgentRunsOptions } from "./agent-runs.options"
import {
    DECISION_ACTOR_UNKNOWN,
    PARK_MAX_RESUMES,
    WORKSPACE_SLICE,
    PARK_PASS_LIMIT,
    PARK_SWEEP_MINUTES,
    TOOL_OUTCOME_UNKNOWN,
} from "./policies/agent-runs.policy"
import type { ParkedPassReport, ResumeRequest, ResumeResult } from "./agent-runs-engine.contracts"

/** Who a resume is recorded under when the machine does it, after a new build and after a pause. */
const ACTOR_BUILD = "build"
const ACTOR_SWEEP = "sweep"

/** The codes of a step whose effect may have happened: it is never run again by anything, only a person reconciles it. */
const OUTCOME_UNKNOWN: ReadonlyArray<string> = [TOOL_OUTCOME_UNKNOWN, CHAT_DELIVERY_UNKNOWN, DECISION_ACTOR_UNKNOWN]

@Injectable()
/**
 * Runs a parked run again from the step it stopped on. A person asks (the owner's action, the CLI), a new build asks for the runs parked
 * under an older one, and the sweep asks for those parked a while, a few times each and with a growing pause: a run that serves a customer
 * conversation climbs the chat ladder (about a minute, then five, then half an hour), any other waits the app's pause, and one that a newer
 * run of its agent already answered in that conversation is closed instead of answering twice. The reset and the job that
 * drives it commit together through the same outbox as every step, so there is no second road: the steps that are done keep their results
 * and are never claimed again, which is why a pivot that was done is never repeated. A compensated run cannot be resumed, and a step whose
 * outcome is unknown stays with a person.
 */
export class AgentRunResumeService implements OnApplicationBootstrap {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly store: AgentRunParkStoreService,
        private readonly runs: AgentRunStoreService,
        private readonly handlers: AgentRunHandlersService,
        private readonly workspaces: AgentRunWorkspacesService,
        @Optional() @InjectAgentRunsOptions() private readonly options: AgentRunsOptions | null = null,
    ) {}

    /** The name of the running build, or an empty text when the app names none. */
    get build(): string {
        return this.options?.buildId ?? ""
    }

    /** After the app started: the runs parked under another build get their failed step run again, since the fix may be in this one. */
    async onApplicationBootstrap(): Promise<void> {
        if (this.build === "") return
        try {
            await this.resumeParked(true)
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.ResumeFailed, cause, { kind: "boot" })
        }
    }

    /** Notes the build a run parked under. */
    async markParked(workspaceId: string, runId: string): Promise<void> {
        if (this.build !== "") await this.store.markParked(workspaceId, runId, this.build)
    }

    /** A person's request: no cap on tries, the reason and the person stay on the run. */
    resume(request: ResumeRequest): Promise<ResumeResult> {
        return this.attempt(request, false)
    }

    /**
     * One pass over the parked runs the machine may take: by build when the app just started (every workspace), else those parked for the
     * sweep's pause (the workspaces `only` names, else the next slice). Each run is bounded in its tries and spaced by a doubling pause; one failing run or
     * workspace never stops the rest.
     */
    async resumeParked(byBuild: boolean, only?: ReadonlyArray<string>): Promise<ParkedPassReport> {
        const found = only ?? (await this.slices(byBuild)).flat()
        const reports: Array<ParkedPassReport> = []
        await eachInOrder(found, async (workspaceId) => {
            try {
                reports.push(await this.resumeIn(workspaceId, byBuild))
            } catch (cause) {
                this.logger.error(AgentRunsLogEvent.ResumeFailed, cause, { kind: "workspace", workspaceId })
            }
        })
        return {
            looked: reports.reduce((sum, report) => sum + report.looked, 0),
            resumed: reports.reduce((sum, report) => sum + report.resumed, 0),
        }
    }

    /** The workspaces a pass visits: every one for the build pass, the next slice for the sweep's. */
    private async slices(all: boolean): Promise<ReadonlyArray<ReadonlyArray<string>>> {
        const slice = await this.workspaces.next()
        if (!all || slice.length < WORKSPACE_SLICE) return [slice]
        return [slice, ...(await this.slices(all))]
    }

    private async resumeIn(workspaceId: string, byBuild: boolean): Promise<ParkedPassReport> {
        const runs = await this.store.parked({
            workspaceId,
            limit: PARK_PASS_LIMIT,
            build: this.build,
            byBuild,
            minAgeSeconds: byBuild ? 0 : this.pauseSeconds(),
            ladder: !byBuild,
            max: this.options?.parkMaxResumes ?? PARK_MAX_RESUMES,
            exclude: OUTCOME_UNKNOWN,
        })
        const resumed: Array<boolean> = []
        await eachInOrder(runs, async ({ runId }) => {
            try {
                const request = {
                    workspaceId,
                    runId,
                    actor: byBuild ? ACTOR_BUILD : ACTOR_SWEEP,
                    reason: byBuild ? `build ${this.build}` : "scheduled retry",
                }
                resumed.push((await this.attempt(request, true)).kind === "resumed")
            } catch (cause) {
                this.logger.error(AgentRunsLogEvent.ResumeFailed, cause, { kind: "pass", runId })
            }
        })
        return { looked: runs.length, resumed: resumed.filter(Boolean).length }
    }

    private pauseSeconds(): number {
        return (this.options?.parkSweepMinutes ?? PARK_SWEEP_MINUTES) * 60
    }

    private async attempt(request: ResumeRequest, auto: boolean): Promise<ResumeResult> {
        const failed = await this.store.failedStepOf(request.workspaceId, request.runId)
        if (failed?.errorCode != null && OUTCOME_UNKNOWN.includes(failed.errorCode)) return { kind: "outcome_unknown" }
        const view =
            failed === null
                ? undefined
                : (await this.runs.viewsOf(request.workspaceId, request.runId)).find(
                      (step) => step.stepKey === failed.stepKey,
                  )
        const input = view === undefined ? undefined : await this.handlers.of(view.kind)?.refresh?.(view)
        const answer = await this.store.resumeRun({
            ...request,
            input,
            auto,
            max: this.options?.parkMaxResumes ?? PARK_MAX_RESUMES,
            backoffSeconds: this.pauseSeconds(),
        })
        if (answer.kind !== "resumed") {
            if (answer.kind !== "superseded") return { kind: answer.kind }
            this.logger.info(AgentRunsLogEvent.RunSuperseded, { runId: request.runId, actor: request.actor })
            return { kind: "not_parked" }
        }
        this.logger.info(AgentRunsLogEvent.RunResumed, {
            runId: request.runId,
            stepKey: answer.stepKey,
            actor: request.actor,
            reason: request.reason,
        })
        return { kind: "resumed", stepKey: answer.stepKey, workspaceId: answer.workspaceId }
    }
}
