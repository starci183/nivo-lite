import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    AgentGraphFreezeGateService,
    AgentGraphsService,
    FOUNDER_ANSWERS_MEMBER,
    stuckKeyOf,
} from "@modules/domain/agent-graphs"
import { AgentRunRecoveryService, AgentRunsService } from "@modules/domain/agent-runs"
import type { AbandonResult, StepJson } from "@modules/domain/agent-runs"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import { isDomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import { isJsonObject, localeOf, stepTitleOf, withLines } from "./lead-freeze.policy"
import type {
    OptionalRunStatus,
    OptionalStoppedRun,
    OptionalText,
    RetriedRun,
    StoppedRun,
} from "./lead-freezes.contracts"

/** How long a retry is driven in place before the job carries the rest of the run. */
const DRIVE_MS = 20_000

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The members of the trigger that carry the customer's own words. */
const WORD_REFS: ReadonlyArray<string> = ["trigger.text", "trigger.messages", "trigger.messageIds"]

/** Whether a node binds any of the customer's words, in its params or its legacy input, at any depth. */
const readsWords = (node: GraphSpecNode): boolean => {
    const written = JSON.stringify([node.params ?? null, node.input ?? null])
    return WORD_REFS.some((ref) => written.includes(`"${ref}"`) || written.includes(`"${ref}.`))
}

/** The conversation a step input's trigger names, or null. */
const conversationOf = (input: StepJson): string | null => {
    const trigger = input.trigger
    return isJsonObject(trigger) ? textOf(trigger.conversationId) : null
}

@Injectable()
/**
 * The runs as a freeze needs them: the run that stopped and the step it stopped on, the title of that step in the owner's language, and
 * the owner's keep of the run (off the machine's resume passes), retry (from the failed step, with the lines the customer wrote while
 * frozen) and abandonment. A retry is driven in place for a bounded time; the run's job carries what is left.
 */
export class LeadFreezeRunsService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly runs: AgentRunsService,
        private readonly recovery: AgentRunRecoveryService,
        private readonly graphs: AgentGraphsService,
        private readonly nodes: GraphNodeRegistryService,
        private readonly gate: AgentGraphFreezeGateService,
        @Optional() private readonly chat?: TeamChatRoomsService,
    ) {}

    /** The run that stopped, with the step it failed on and whether that step is a node step of a graph; null when there is no such run. */
    async stoppedOf(workspaceId: string, runId: string): Promise<OptionalStoppedRun> {
        const run = await this.runs.runOf(workspaceId, runId)
        if (run === null) return null
        const failed = await this.recovery.failedStepOf(workspaceId, runId)
        return {
            runId: run.id,
            agentId: run.agentId,
            status: run.status,
            failed: failed === null ? null : { ...failed, nodeStep: this.gate.isNodeStep(failed.kind) },
            context: run.context,
            locale: localeOf(run.context),
        }
    }

    /** Where a run stands, or null when it is gone. */
    async statusOf(workspaceId: string, runId: string): Promise<OptionalRunStatus> {
        return (await this.runs.runOf(workspaceId, runId))?.status ?? null
    }

    /** The title of the failed step in the owner's language: the installed node's own title, else the node's key. */
    async stepTitleOf(workspaceId: string, run: StoppedRun): Promise<OptionalText> {
        if (run.failed === null) return null
        const nodeKey = run.failed.nodeKey
        const versionId = textOf(run.failed.input.versionId)
        if (versionId === null) return nodeKey
        try {
            const { flow } = await this.graphs.documentOf(workspaceId, run.agentId, versionId)
            const node = flow?.nodes.find((candidate) => candidate.key === nodeKey)
            const title = node === undefined ? undefined : this.nodes.installed().nodes.get(node.step)?.title
            return stepTitleOf(title, nodeKey, run.locale)
        } catch (cause) {
            const code = isDomainError(cause) ? cause.code : "unexpected"
            this.logger.warn(LeadFreezesLogEvent.StepTitleUnread, { runId: run.runId, code })
            return nodeKey
        }
    }

    /**
     * Whether the step a run failed on reads the customer's words (a binding of `trigger.text`, `trigger.messages` or `trigger.messageIds`):
     * only such a step takes the lines the customer wrote while frozen into its retry. Any other step (an outcome, a send, a save) is
     * retried as it was, and the lines are replayed as their own turn after the release, so no line is ever swallowed by a step that
     * never reads it. False when the run, its failed step or its graph cannot be read.
     */
    async readsCustomerWords(workspaceId: string, runId: string): Promise<boolean> {
        const failed = await this.recovery.failedStepOf(workspaceId, runId)
        const run = await this.runs.runOf(workspaceId, runId)
        const versionId = failed === null ? null : textOf(failed.input.versionId)
        if (failed === null || run === null || versionId === null) return false
        try {
            const { flow } = await this.graphs.documentOf(workspaceId, run.agentId, versionId)
            const node = flow?.nodes.find((candidate) => candidate.key === failed.nodeKey)
            return node !== undefined && readsWords(node)
        } catch (cause) {
            const code = isDomainError(cause) ? cause.code : "unexpected"
            this.logger.warn(LeadFreezesLogEvent.StepTitleUnread, { runId, code })
            return false
        }
    }

    /** Takes the run off the machine's resume passes: it is the owner's now. */
    keep(workspaceId: string, runId: string): Promise<boolean> {
        return this.recovery.keep(workspaceId, runId)
    }

    /**
     * Runs the run again from its failed step for the owner, the customer's lines `fold` names added to the failed step's trigger, and
     * with them what the founder answered in the team chat to the report of that step, so the step (and the AI core, if it is asked
     * again) reads the answer as a fact. Drives it in place for a bounded time. Answers how the resume went and where the run stands.
     */
    async retry(workspaceId: string, runId: string, actor: string, fold: ReadonlyArray<string>): Promise<RetriedRun> {
        const resume = await this.recovery.retry({
            workspaceId,
            runId,
            actor,
            reason: "lead-freeze retry",
            input: async (current) => this.withAnswers(workspaceId, runId, await this.withFolded(workspaceId, current, fold)),
        })
        if (resume.kind !== "resumed") return { resume, status: await this.statusOf(workspaceId, runId) }
        const advanced = await this.runs.advance(workspaceId, runId, AbortSignal.timeout(DRIVE_MS))
        return { resume, status: advanced.run?.status ?? null }
    }

    /** Closes the run for good: the owner skipped its turn. */
    abandon(workspaceId: string, runId: string, actor: string): Promise<AbandonResult> {
        return this.recovery.abandon(workspaceId, runId, actor)
    }

    /** The failed step's input with what the founder replied to its report in the team chat, oldest first; unchanged when nothing was. */
    private async withAnswers(workspaceId: string, runId: string, current: StepJson): Promise<StepJson> {
        const failed = this.chat === undefined ? null : await this.recovery.failedStepOf(workspaceId, runId)
        if (this.chat === undefined || failed === null || !isJsonObject(current.trigger)) return current
        const answers = await this.chat.repliesToAgentLine(workspaceId, stuckKeyOf(runId, failed.stepKey))
        if (answers.length === 0) return current
        const said = answers.map((answer) => ({ text: answer.text, at: answer.at }))
        return { ...current, trigger: { ...current.trigger, [FOUNDER_ANSWERS_MEMBER]: said } }
    }

    private async withFolded(workspaceId: string, current: StepJson, fold: ReadonlyArray<string>): Promise<StepJson> {
        const conversationId = conversationOf(current)
        if (fold.length === 0 || conversationId === null) return current
        return withLines(current, await this.gate.linesOf(workspaceId, conversationId, fold))
    }
}
