import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentOwnershipService } from "@modules/domain/agents"
import { AuthorityRulesService, ruleAmountOf } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { ModuleCatalogService, WorkEngineService } from "@modules/domain/decisions"
import type { ActionEntry, WorkItem } from "@modules/domain/decisions"
import { ThreadAgentPostsService } from "@modules/domain/thread-messages"
import type { MentionRef } from "@modules/domain/work-chains"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ThreadWorkRow, WorkAgentRow } from "./persistence/thread-work.rows"
import { INSERT_THREAD_WORK, LIST_WORK_AGENTS, UPDATE_THREAD_WORK } from "./persistence/thread-work.sql"
import { amountText, groupMentionOf, nextStepOf, workAgentOf } from "./thread-work.policy"
import type { AgentStep, ThreadWorkState, WorkAgent, WorkPlace } from "./thread-work.contracts"

/** One line an agent writes in its thread: the text, who it tags, the title of the chain step it makes. */
interface AgentLine {
    readonly body: string
    readonly mentions: ReadonlyArray<MentionRef>
    readonly stepTitle: string
}

/** Where a piece of thread work goes next, as the row records it. */
interface WorkMove {
    readonly state: ThreadWorkState
    readonly requestId: string | null
    readonly memberId: string | null
    readonly missing: ReadonlyArray<string>
}

/** Nothing is waited for. */
const SETTLED: Omit<WorkMove, "state"> = { requestId: null, memberId: null, missing: [] }

@Injectable()
/**
 * The agents' turns in a work thread. Each step of an agent runs through the work engine, so the authority gate decides it as it
 * decides every agent action; the agent then says in the thread what came of it: an approval ask with its card when the gate asks a
 * person over authority, a tag of the person who holds the missing data, a hand-off to the next agent it may tag when the step is
 * done (the registry says which action comes next), or the owner when the work stopped. Every line goes through the thread's own
 * door (ThreadAgentPostsService), so the tag rules and the chain limits hold.
 */
export class ThreadWorkTurnsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly engine: WorkEngineService,
        private readonly posts: ThreadAgentPostsService,
        private readonly modules: ModuleCatalogService,
        private readonly rules: AuthorityRulesService,
        private readonly ownership: AgentOwnershipService,
    ) {}

    /**
     * Runs one step of an agent through the work engine and says in the thread what came of it; a step is run once. Answers where
     * the work of the step stands, or null when it is still queued or was run before.
     */
    async run(step: AgentStep): Promise<ThreadWorkState | null> {
        const ctx = { workspaceId: step.workspaceId, actor: step.actorName, locale: "vi" } as const
        const item = await this.engine.runWork(ctx, {
            action: step.action,
            subject_type: "lead",
            subject_id: step.leadId,
            lead_id: step.leadId,
            parent_id: step.parentId,
            dedupeKey: `thread:${step.threadId}:${step.agent.id}:${step.action}`,
            seed: step.seed,
        })
        const [row] = await this.entityManager.query<Array<ThreadWorkRow>>(INSERT_THREAD_WORK, [
            step.workspaceId,
            step.threadId,
            item.id,
            step.agent.id,
        ])
        if (row?.state !== "running") return null
        const place = { workspaceId: step.workspaceId, threadId: step.threadId, workId: row.id, agent: step.agent }
        return this.react({ ...place, locale: "vi" }, item)
    }

    /**
     * Says in the thread what the engine did with a step and moves the work on; answers where it stands, or null for a step still
     * queued (the drain runs it).
     */
    react(place: WorkPlace, item: WorkItem): Promise<ThreadWorkState | null> {
        if (item.status === "waiting_decision") {
            return item.reason === "missing_data" ? this.askMember(place, item) : this.askApproval(place, item)
        }
        if (item.status === "done") return this.handOff(place, item)
        if (item.status === "failed" || item.status === "rejected") return this.stop(place, item)
        return Promise.resolve(null)
    }

    /** Records where a piece of thread work stands, and answers it. */
    async move(place: Pick<WorkPlace, "workspaceId" | "workId">, move: WorkMove): Promise<ThreadWorkState> {
        await this.entityManager.query(UPDATE_THREAD_WORK, [
            place.workspaceId,
            place.workId,
            move.state,
            move.requestId,
            move.memberId,
            move.missing,
        ])
        return move.state
    }

    /** Over authority: the agent tags the rule's approver group and its message carries the approval card. */
    private async askApproval(place: WorkPlace, item: WorkItem): Promise<ThreadWorkState> {
        const setup = await this.rules.approvalSetup(place.workspaceId, item.action)
        const mention = setup === null ? null : groupMentionOf(setup.group)
        if (setup === null || mention === null) return this.stop(place, item)
        const action = await this.labelOf(item.action)
        const amount = ruleAmountOf(item.proposal, setup.unit)
        const posted = await this.posts.postAsAgent({
            workspaceId: place.workspaceId,
            threadId: place.threadId,
            agentId: place.agent.id,
            body: this.text("threadWork.ask", { action, summary: item.proposal.summary }),
            mentions: [mention],
            quoted: [],
            stepTitle: this.text("threadWork.askStep", { action }),
            approval: {
                actionKey: item.action,
                title: amount === null ? action : `${action} ${amountText(amount, setup.unit, place.locale)}`,
                amount,
                unit: setup.unit,
                rule: action,
            },
            locale: place.locale,
        })
        const requestId = posted.message.approval?.requestId ?? null
        const asked = posted.stopped === null && requestId !== null
        return this.move(place, { ...SETTLED, state: asked ? "asked" : "stopped", requestId })
    }

    /** Missing data: the agent tags the person the rule names (else the agent's owner) and waits for their answer. */
    private async askMember(place: WorkPlace, item: WorkItem): Promise<ThreadWorkState> {
        const setup = await this.rules.approvalSetup(place.workspaceId, item.action)
        const memberId = await this.dataHolderOf(place, setup)
        const action = await this.labelOf(item.action)
        const fields = item.missing_fields.map((field) => this.fieldLabel(field)).join(", ")
        const stopped = await this.say(place, {
            body: this.text("threadWork.missing", { action, fields }),
            mentions: [{ kind: "member", id: memberId }],
            stepTitle: this.text("threadWork.missingStep", { fields }),
        })
        const waiting = stopped === null
        return this.move(place, {
            state: waiting ? "waiting_member" : "stopped",
            requestId: null,
            memberId: waiting ? memberId : null,
            missing: waiting ? item.missing_fields : [],
        })
    }

    /** Done: the agent hands the next action to the agent it may tag that performs it, or closes the work with its result. */
    private async handOff(place: WorkPlace, item: WorkItem): Promise<ThreadWorkState> {
        const done = item.result?.summary ?? item.proposal.summary
        const next = nextStepOf(await this.nextEntries(item.action), await this.targetsOf(place))
        if (next === null) {
            await this.say(place, {
                body: item.proposal.draft ?? done,
                mentions: [],
                stepTitle: this.text("threadWork.doneStep", { action: await this.labelOf(item.action) }),
            })
            return this.move(place, { ...SETTLED, state: "done" })
        }
        const nextLabel = await this.labelOf(next.action)
        const stopped = await this.say(place, {
            body: this.text("threadWork.handoff", { done, next: nextLabel }),
            mentions: [{ kind: "agent", id: next.agent.id }],
            stepTitle: this.text("threadWork.handoffStep", { next: nextLabel }),
        })
        const state = await this.move(place, { ...SETTLED, state: stopped === null ? "done" : "stopped" })
        if (stopped !== null || item.lead_id === null) return state
        const customer = String(item.proposal.fields.customer ?? "")
        await this.run({
            workspaceId: place.workspaceId,
            threadId: place.threadId,
            agent: next.agent,
            action: next.action,
            leadId: item.lead_id,
            seed: {
                summary: this.text("threadWork.nextSummary", { next: nextLabel, customer }),
                draft: this.text("threadWork.confirmation", { customer, done }),
                amount_vnd: item.proposal.amount_vnd ?? null,
                fields: item.proposal.fields,
            },
            parentId: item.id,
            actorName: place.agent.name,
        })
        return state
    }

    /** Stopped: the agent tells the person who answers for it why, and tags them. */
    private async stop(place: WorkPlace, item: WorkItem): Promise<ThreadWorkState> {
        const owner = await this.ownership.ownerOf(place.agent.id)
        const action = await this.labelOf(item.action)
        await this.say(place, {
            body: this.text("threadWork.stopped", { action, reason: item.error ?? item.result?.summary ?? "" }),
            mentions: [{ kind: "member", id: owner.ownerMemberId }],
            stepTitle: this.text("threadWork.stopped", { action, reason: "" }),
        })
        return this.move(place, { ...SETTLED, state: "stopped" })
    }

    /** Writes one line of the agent; answers why the chain stopped, or null while it goes on. */
    private async say(place: WorkPlace, line: AgentLine): Promise<string | null> {
        const posted = await this.posts.postAsAgent({
            workspaceId: place.workspaceId,
            threadId: place.threadId,
            agentId: place.agent.id,
            body: line.body,
            mentions: line.mentions,
            quoted: [],
            stepTitle: line.stepTitle,
            approval: null,
            locale: place.locale,
        })
        return posted.stopped
    }

    /** The person who holds the data a step misses: the first member the rule names, else the owner of the agent. */
    private async dataHolderOf(place: WorkPlace, setup: ApprovalSetup | null): Promise<string> {
        const [named] = setup?.group.members ?? []
        return named ?? (await this.ownership.ownerOf(place.agent.id)).ownerMemberId
    }

    /** The registry entries of the actions queued after an action, in its order. */
    private async nextEntries(action: string): Promise<ReadonlyArray<ActionEntry>> {
        const entry = await this.modules.actionOf(action)
        const entries = await Promise.all((entry?.next ?? []).map((next) => this.modules.actionOf(next)))
        return entries.filter((next): next is ActionEntry => next !== null)
    }

    /** The active agents the agent may tag, in its order. */
    private async targetsOf(place: WorkPlace): Promise<ReadonlyArray<WorkAgent>> {
        const rows = await this.entityManager.query<Array<WorkAgentRow>>(LIST_WORK_AGENTS, [
            place.workspaceId,
            place.agent.canTag,
        ])
        return rows.map(workAgentOf)
    }

    private async labelOf(action: string): Promise<string> {
        return (await this.modules.actionOf(action))?.label.vi ?? action
    }

    private fieldLabel(field: string): string {
        const key = `engine.field.${field}`
        const label = this.catalog.get(key, {}, "vi")
        return label === key ? field : label
    }

    private text(key: string, params: Readonly<Record<string, string>>): string {
        return this.catalog.get(key, params, "vi")
    }
}
