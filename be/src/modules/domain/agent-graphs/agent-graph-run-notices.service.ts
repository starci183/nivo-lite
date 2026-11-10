import { Injectable, Optional } from "@nestjs/common"
import { TOOL, STOPPED_DECISIONS } from "@nivo-lite/blocks-core"
import { workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import type { WorkflowStoppedPayload } from "@nivo-lite/blocks-core"
import type { StepJson, StepView } from "@modules/domain/agent-runs"
import { ChatConversationsService, HOLDING_LINE_KEY_PREFIX } from "@modules/domain/chat-records"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { isDomainError } from "@modules/platform/errors"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphFreezeGateService, type FlowStop } from "./agent-graph-freeze-gate.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import {
    FOUNDER_ANSWERS_MEMBER,
    factLinesOf,
    stuckKeyOf,
    type CoreSuggestion,
    type StepTrouble,
    type StuckFacts,
} from "./policies/step-trouble.policy"

/** The effect the owner's items are raised through. */
const RAISE_EFFECT: string = TOOL.workItemRaise

/** The action of the owner item of a run that stopped: approving it runs the run again from where it stopped. */
const RUN_REVIEW_ACTION = "review_agent_run"

/** The action of the owner item that tells a side step failed while the run went on: a review, nothing to resume. */
const SIDE_STEP_REVIEW_ACTION = "review_side_step"

/** The effect a line to the customer is sent through: the channel's own send path. */
const SEND_EFFECT: string = TOOL.customerMessageSend

/** The effect the team is told through: one line of the agent in the team chat. */
const TEAM_EFFECT: string = TOOL.teamMessagePost

/** The kind of the team's message of a stopped workflow: the common card of nivo core, built by the team chat's executor. */
const TEAM_KIND = "workflow.stopped"

/** The most characters the readable line of the card takes. */
const TEAM_TEXT_MAX = 4000

/** Why a customer's line did not go out when no domain error says it. */
const SEND_THREW = "send_threw"
const NO_CONVERSATION = "no_conversation"


/** The AI core's words to the founder about a step it could not complete. */
export interface StuckReport {
    /** Why the step stopped, in the AI's words. */
    readonly reason: string
    /** The one thing it needs answered, or null. */
    readonly question: string | null
    /** 2 or 3 ways on, each a line the founder can send as the answer. */
    readonly suggestions: ReadonlyArray<CoreSuggestion>
}

/** What is told about a step nothing could complete. */
export interface StuckTold {
    /** The report in the AI core's own words; null when the AI itself failed, and the engine's static words stand in. */
    readonly report: StuckReport | null
    /** What the AI core chose to tell the customer, or null: nothing is said. The engine never writes one itself. */
    readonly customerLine: string | null
    /** The true facts the engine attaches. */
    readonly facts: StuckFacts
    /** The customer the run is about, when the engine knows one. */
    readonly leadId: string | null
}

/** What a notice of a node step is about: the step, the turn it ran in, its trigger scope and why it failed. */
export interface RunNotice {
    /** The failed step. */
    readonly step: StepView
    /** The turn the step ran in. */
    readonly turn: NodeTurn
    /** The trigger scope of the run. */
    readonly trigger: StepJson
    /** Why the step failed. */
    readonly code: string
    /** The workflow the run executes, when known; the card names it from the run's namespace otherwise. */
    readonly workflow?: { readonly moduleKey: string; readonly key: string; readonly title: string } | undefined
    /** The installed node the step runs, when known. */
    readonly nodeId?: string | undefined
    /** The customer the run is about, when the engine knows one. */
    readonly leadId?: string | null | undefined
}

/** The workflow a namespace (`<moduleKey>.<workflowKey>`) names; the title is the key until a name is known. */
export const workflowRefOf = (namespace: string): { moduleKey: string; key: string; title: string } => {
    const dot = namespace.indexOf(".")
    const moduleKey = dot < 0 ? namespace : namespace.slice(0, dot)
    const key = dot < 0 ? "" : namespace.slice(dot + 1)
    return { moduleKey, key, title: key === "" ? moduleKey : key }
}

/** How many answers of the founder the step has already been run again with: part of which stop of the step a report is about. */
const answersCountOf = (trigger: StepJson): number => {
    const listed: unknown = trigger[FOUNDER_ANSWERS_MEMBER]
    return Array.isArray(listed) ? listed.length : 0
}

@Injectable()
/**
 * What a node graph's run tells people when a step cannot complete. The team is told in the team chat with ONE common card
 * (`workflow.stopped`) per stuck step: the AI core's reason, question and suggested ways on with the engine's true facts, or, only when
 * the AI itself failed, the engine's static "AI error" words with the same facts and the three freeze decisions. The same step of the
 * same run stopping again folds into the same card. The customer is told only what the AI core chose to tell them, as the agent that speaks in
 * their conversation; the engine writes no line to a customer itself. A run that stopped for good also gets its freeze, or, in an app
 * that keeps no freezes, one review item per run; a side step that was passed over gets one review item.
 */
export class AgentGraphRunNoticesService {
    constructor(
        private readonly nodes: GraphNodeRegistryService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        @Optional() private readonly freezes?: AgentGraphFreezeGateService,
        @Optional() private readonly conversations?: ChatConversationsService,
        @Optional() private readonly runs?: AgentWorkflowRunsService,
    ) {}

    /**
     * A run that stopped at a node step: its customer is frozen (the freeze holds the owner's one item), or the run gets its own
     * review item; then the team chat is told with the facts, under the key of the stuck step, so a step the AI core already reported
     * is not reported twice and a run that died outside a node (a row nobody can read) is still never silent.
     */
    async runStopped(notice: RunNotice): Promise<void> {
        const { step, turn, code } = notice
        const stop = {
            workspaceId: step.workspaceId,
            runId: step.runId,
            code,
            stepKey: step.stepKey,
            trigger: notice.trigger,
        }
        const isFrozen = await this.frozen(stop)
        if (!isFrozen) {
            await this.raise(turn, {
                action: RUN_REVIEW_ACTION,
                titleKey: "agentGraphs.runDead.title",
                payload: { runId: step.runId, nodeKey: step.nodeKey, code, conversationId: turn.conversationId },
                dedupeKey: `graph-run-dead:${step.runId}`,
            })
        }
        const engine = this.catalog.get("agentGraphs.stuck.engine", {}, turn.locale)
        await this.tellTeam(
            notice,
            { by: "engine", reason: engine, question: null, suggestions: [] },
            [
                ["step", step.nodeKey],
                ["code", code],
                ["run", step.runId],
            ],
            isFrozen,
        )
    }

    /** Keeps the raw technical cause of a step that could not complete for developers, whatever the AI core then decides. */
    troubled(step: StepView, trouble: StepTrouble): void {
        this.logger.warn(AgentGraphsLogEvent.StepTroubled, {
            runId: step.runId,
            stepKey: step.stepKey,
            kind: trouble.kind,
            code: trouble.code,
            cause: trouble.text,
        })
    }

    /** Records that the AI core produced the output of a step that could not complete, so the run went on. */
    recovered(step: StepView, trouble: StepTrouble): void {
        this.logger.info(AgentGraphsLogEvent.StepRecovered, {
            runId: step.runId,
            stepKey: step.stepKey,
            code: trouble.code,
        })
    }

    /**
     * A step nothing could complete: the team is told in the team chat, in the AI core's words with the facts under them (the engine's
     * static "AI error" words only when the AI itself failed), and the customer gets the line the AI core chose, when it chose one.
     */
    async stuck(notice: RunNotice, told: StuckTold): Promise<void> {
        const { step, turn } = notice
        const said: Said =
            told.report === null
                ? {
                      by: "engine",
                      reason: this.catalog.get("agentGraphs.stuck.aiFailed", {}, turn.locale),
                      question: null,
                      suggestions: [],
                  }
                : { by: "ai", ...told.report }
        await this.tellTeam(notice, said, told.facts, told.report === null)
        this.logger.info(AgentGraphsLogEvent.StuckReported, {
            runId: step.runId,
            stepKey: step.stepKey,
            code: notice.code,
            by: said.by,
        })
        if (told.customerLine !== null) await this.customerLine(step, turn, told.customerLine, told.leadId)
    }

    /**
     * The one card of a stuck step in the team chat, built and posted by the team chat's executor under the key of the step, so the
     * same step stopping again folds into it. Who worded it is stated: the AI's words, or the engine's static ones. The decisions are
     * the engine's three, offered only when the engine speaks and the stopped run holds a freeze to decide on.
     */
    private async tellTeam(notice: RunNotice, said: Said, facts: StuckFacts, decidable: boolean): Promise<void> {
        const { step, turn } = notice
        const post = this.nodes.optionalExecutorOf(TEAM_EFFECT)
        if (post === undefined) return
        const now = this.clock.now().toISOString()
        const key = stuckKeyOf(step.runId, step.stepKey)
        const workflow = notice.workflow ?? workflowRefOf("")
        const nodeId = notice.nodeId ?? step.nodeKey
        const card: WorkflowStoppedPayload = {
            workflow: { ...workflow, title: await this.workflowTitleOf(notice, workflow, turn.locale) },
            step: { key: step.stepKey, nodeId, title: this.stepTitleOf(nodeId, turn.locale) ?? step.nodeKey },
            runId: step.runId,
            leadId: notice.leadId ?? null,
            conversationId: turn.conversationId,
            by: said.by,
            reason: said.reason,
            question: said.question,
            facts: facts.map(([name, value]) => ({ name, value })),
            suggestions: said.suggestions,
            decisions: said.by === "engine" && decidable ? [...STOPPED_DECISIONS] : [],
            repeats: 1,
            firstAt: now,
            lastAt: now,
        }
        const readable = [said.reason, said.question ?? "", factLinesOf(facts)].filter((part) => part !== "").join("\n")
        // The payload of the engine's own card: the team chat's executor validates the content, builds the card and folds a repeat into
        // the card already there; a model's `team.message.post` can never name this kind. The occurrence names this stop of the step,
        // so a replay of the same stop folds nothing twice.
        const payload = {
            kind: TEAM_KIND,
            title: this.catalog.get("agentGraphs.stuck.title", {}, turn.locale),
            summary: readable.slice(0, TEAM_TEXT_MAX),
            card,
        }
        const occurrence = `${key}:${String(answersCountOf(notice.trigger))}:${String(step.attempt)}`
        await post.execute(turn, payload, { key: occurrence, dedupeKey: key })
    }

    /**
     * The name the team knows the run's workflow by: the workflow's own name (the owner may have renamed it), else the name of the NIVO
     * template it was made from, else its key. A name that cannot be read never keeps the card from being posted.
     */
    private async workflowTitleOf(
        notice: RunNotice,
        workflow: { readonly moduleKey: string; readonly key: string; readonly title: string },
        locale: NodeTurn["locale"],
    ): Promise<string> {
        const own = await this.runs
            ?.pinsOf(notice.step.workspaceId, [notice.step.runId])
            .then(([pin]) => pin?.workflowName ?? "")
            .catch((cause: unknown) => {
                this.logger.error(AgentGraphsLogEvent.WorkflowNameFailed, cause, { runId: notice.step.runId })
                return ""
            })
        if (own !== undefined && own !== "") return own
        const template = workflowTemplateOf(`${workflow.moduleKey}.${workflow.key}`)
        return template === null ? workflow.title : locale === "en" ? template.name.en : template.name.vi
    }

    /** The title of the installed node a step runs, in the team's language; null for a step no installed node is. */
    private stepTitleOf(nodeId: string, locale: NodeTurn["locale"]): string | null {
        const title = this.nodes.installed().nodes.get(nodeId)?.title
        if (title === undefined) return null
        return "key" in title ? this.catalog.get(title.key, {}, locale) : locale === "en" ? title.en : title.vi
    }

    /** Whether the stopped run froze its customer; a freeze that could not be read never silences the run's own review. */
    private async frozen(stop: FlowStop): Promise<boolean> {
        try {
            return (await this.freezes?.stopped(stop)) === true
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.FreezeFailed, cause, { runId: stop.runId })
            return false
        }
    }

    /** A side node that failed while the run went on: one review item per step, nothing to resume. */
    async sidePassedOver(notice: RunNotice): Promise<void> {
        const { step, turn, code } = notice
        await this.raise(turn, {
            action: SIDE_STEP_REVIEW_ACTION,
            titleKey: "agentGraphs.sideStepFailed.title",
            payload: { runId: step.runId, nodeKey: step.nodeKey, code, conversationId: turn.conversationId },
            dedupeKey: `graph-side-step:${step.runId}:${step.stepKey}`,
        })
    }

    private async raise(turn: NodeTurn, item: OwnerItem): Promise<void> {
        const raise = this.nodes.optionalExecutorOf(RAISE_EFFECT)
        if (raise === undefined) return
        const payload = {
            action: item.action,
            title: this.catalog.get(item.titleKey, {}, turn.locale),
            payload: item.payload,
        }
        await raise.execute(turn, payload, { key: item.dedupeKey, dedupeKey: item.dedupeKey })
    }

    /**
     * Sends the line the AI core chose for the customer, once per stuck step, as the agent that speaks in their conversation now: the
     * conversation of the run, else the newest one of the customer the run is about. A line the channel refuses (a person took the
     * conversation, the Zalo window closed) is logged, never thrown: the team already knows.
     */
    private async customerLine(step: StepView, turn: NodeTurn, text: string, leadId: string | null): Promise<void> {
        const send = this.nodes.optionalExecutorOf(SEND_EFFECT)
        const conversationId = turn.conversationId ?? (await this.conversationOfLead(turn.workspaceId, leadId))
        if (send === undefined || conversationId === null) {
            this.logger.info(AgentGraphsLogEvent.StuckLineSkipped, { runId: step.runId, code: NO_CONVERSATION })
            return
        }
        // Under the holding-line prefix: a line said while the workflow waits never counts as the answer to the customer's message.
        const key = `${HOLDING_LINE_KEY_PREFIX}${step.runId}:${step.stepKey}`
        try {
            const speaker = await this.speakerTurn({ ...turn, conversationId }, conversationId)
            await send.execute(speaker, { conversationId, text }, { key, dedupeKey: key })
            this.logger.info(AgentGraphsLogEvent.StuckLineSent, { runId: step.runId })
        } catch (cause) {
            const code = isDomainError(cause) ? cause.code : SEND_THREW
            this.logger.warn(AgentGraphsLogEvent.StuckLineSkipped, { runId: step.runId, code })
        }
    }

    /** The newest conversation of a customer, or null. */
    private async conversationOfLead(workspaceId: string, leadId: string | null): Promise<string | null> {
        if (leadId === null || this.conversations === undefined) return null
        const [newest] = await this.conversations.ofLeads(workspaceId, [leadId])
        return newest?.id ?? null
    }

    /**
     * The turn a line to the customer goes out in: sent by the agent that holds the right to speak in the conversation now (a keeper
     * may have taken it, or the front door met the customer again), so the line never fails on who speaks.
     */
    private async speakerTurn(turn: NodeTurn, conversationId: string): Promise<NodeTurn> {
        const found = await this.conversations?.turnOf(turn.workspaceId, conversationId)
        return found?.kind === "ok" ? { ...turn, agentId: found.value.agent.id } : turn
    }
}

/** What a card says: who worded it, and the words. */
interface Said {
    readonly by: "ai" | "engine"
    readonly reason: string
    readonly question: string | null
    readonly suggestions: ReadonlyArray<CoreSuggestion>
}

/** One owner item a notice raises. */
interface OwnerItem {
    /** The action of the item. */
    readonly action: string
    /** The catalogue key of its title. */
    readonly titleKey: string
    /** What it names. */
    readonly payload: Readonly<Record<string, string | null>>
    /** Its key, once per run or per step. */
    readonly dedupeKey: string
}
