import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ApprovalRequestsHistoryReadService } from "@modules/domain/approval-requests"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { LeadReadService } from "@modules/domain/leads"
import { ThreadWorkLinksReadService } from "@modules/domain/thread-work"
import { WorkChainsHistoryReadService } from "@modules/domain/work-chains"
import { WorkThreadsLeadsReadService } from "@modules/domain/work-threads"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import type { MemberDirectoryEntry } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DecisionRecord } from "./decisions-views.contracts"
import { DecisionEntity } from "./persistence/entities"

/** Orders two texts that compare byte by byte (fixed-width instants, lower-case uuids), the greater first. */
const newestFirst = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? 1 : -1
}

/** What the history is narrowed to; a null filter does not narrow. */
export interface DecisionHistoryFilter {
    /** The deciders to keep (`policy`, `owner`, `staff`). */
    readonly deciders: ReadonlyArray<string> | null
    /** The outcome to keep. */
    readonly outcome: string | null
    /** The module to keep. */
    readonly department: string | null
    /** The most lines. */
    readonly limit: number
}

/** A line of the history before the customer name is read; `sort_key` orders lines of different sources at full precision. */
type RawLine = Omit<DecisionRecord, "leadName"> & { readonly sort_key: string }

/** What one pass over a source answers: how many rows it scanned and the lines it kept. */
interface Pass {
    /** The rows the pass read. */
    readonly scanned: number
    /** The lines that survived the filters. */
    readonly kept: Array<RawLine>
}

/** The most passes one source reads to fill a page when a filter on the joined rows drops some of them. */
const PASSES_MAX = 5

/** Postgres text of the instant that sorts like the instant: fixed width, UTC, to the microsecond. */
const SORT_KEY = "YYYYMMDDHH24MISS.US"

/** The same sortable text of an instant held to the millisecond. */
const sortKeyOf = (at: Date): string => at.toISOString().replaceAll(/[-:T]/g, "").replace("Z", "000")

/** The decider a request counts as: the owner or staff who settled it; the policy when nobody (or nobody known) did. */
const deciderOf = (member: MemberDirectoryEntry | undefined): string => {
    if (member === undefined) return "policy"
    return member.role === "owner" ? "owner" : "staff"
}

/** Whether the decider passes the filter. */
const deciderWanted = (filter: DecisionHistoryFilter, decider: string): boolean =>
    filter.deciders === null || filter.deciders.includes(decider)

@Injectable()
/** Reads the decision history of a workspace from the three sources that hold it. */
export class DecisionHistoryService {
    /** Captures the primary entity manager and the owners' read services the other two sources and the names come from. */
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly requests: ApprovalRequestsHistoryReadService,
        private readonly chains: WorkChainsHistoryReadService,
        private readonly threads: WorkThreadsLeadsReadService,
        private readonly threadWork: ThreadWorkLinksReadService,
        private readonly rules: AuthorityRulesService,
        private readonly agents: AgentDirectoryService,
        private readonly members: WorkspaceMemberDirectoryService,
        private readonly leads: LeadReadService,
    ) {}

    /**
     * The newest lines of the decision history with the customer name: the decision log of the work engine, the approval requests the
     * engine does not log (verdicts given on a thread card outside an agent's work, and every request that ran out of time), and the
     * tasks a member completed after being tagged in a thread no agent's work runs in. Each source is read for its newest `limit`
     * lines, the lines are merged newest first (ties by id, descending), and the customer names are read for the page.
     */
    async list(workspaceId: string, filter: DecisionHistoryFilter): Promise<Array<DecisionRecord>> {
        const sources = [
            ...(await this.logged(workspaceId, filter)),
            ...(await this.filled(filter.limit, (skip) => this.approvalLines(workspaceId, filter, skip))),
            ...(await this.filled(filter.limit, (skip) => this.taskLines(workspaceId, filter, skip))),
        ]
        const page = sources
            .toSorted((left, right) => newestFirst(left.sort_key, right.sort_key) || newestFirst(left.id, right.id))
            .slice(0, filter.limit)
        const leadIds = [...new Set(page.flatMap((line) => (line.lead_id === null ? [] : [line.lead_id])))]
        const names = new Map(
            (await this.leads.cardsOf(workspaceId, leadIds)).map((card) => [card.id, card.contactName]),
        )
        return page.map(({ sort_key: _key, ...line }) => ({
            ...line,
            leadName: line.lead_id === null ? null : (names.get(line.lead_id) ?? null),
        }))
    }

    /** Reads passes from a source until `limit` lines survived its filters, the source ran dry or the passes ran out. */
    private async filled(limit: number, pass: (skip: number) => Promise<Pass>): Promise<Array<RawLine>> {
        const lines: Array<RawLine> = []
        let skip = 0
        for (let index = 0; index < PASSES_MAX && lines.length < limit; index += 1) {
            const read = await pass(skip)
            lines.push(...read.kept)
            if (read.scanned < limit) break
            skip += read.scanned
        }
        return lines.slice(0, limit)
    }

    /** The members among the ids, by membership id. */
    private async membersById(
        workspaceId: string,
        ids: ReadonlyArray<string | null>,
    ): Promise<Map<string, MemberDirectoryEntry>> {
        const wanted = [...new Set(ids.flatMap((id) => (id === null ? [] : [id])))]
        return new Map((await this.members.byIds(workspaceId, wanted)).map((member) => [member.id, member]))
    }

    /** The decision log lines: who decided each work item. */
    private async logged(workspaceId: string, filter: DecisionHistoryFilter): Promise<Array<RawLine>> {
        const select = this.entityManager
            .createQueryBuilder(DecisionEntity, "d")
            .select("d.id", "id")
            .addSelect("d.workItemId", "work_item_id")
            .addSelect("d.leadId", "lead_id")
            .addSelect("d.department", "department")
            .addSelect("d.action", "action")
            .addSelect("d.decidedBy", "decided_by")
            .addSelect("d.decidedByMemberId", "decidedByMemberId")
            .addSelect("d.deciderKind", "decider_kind")
            .addSelect("d.outcome", "outcome")
            .addSelect("d.reason", "reason")
            .addSelect("COALESCE(d.note, '')", "note")
            .addSelect("to_json(d.createdAt) #>> '{}'", "created_at")
            .addSelect(`to_char(d.createdAt AT TIME ZONE 'UTC', '${SORT_KEY}')`, "sort_key")
            .where("d.workspaceId = :workspaceId", { workspaceId })
        if (filter.deciders !== null)
            select.andWhere("d.deciderKind IN (:...deciders)", { deciders: [...filter.deciders] })
        if (filter.outcome !== null) select.andWhere("d.outcome = :outcome", { outcome: filter.outcome })
        if (filter.department !== null) select.andWhere("d.department = :department", { department: filter.department })
        const lines = await select
            .orderBy("d.createdAt", "DESC")
            .addOrderBy("d.id", "DESC")
            .limit(filter.limit)
            .getRawMany<RawLine>()
        const members = await this.membersById(
            workspaceId,
            lines.map((line) => line.decidedByMemberId),
        )
        return lines.map((line) => ({
            ...line,
            decided_by: members.get(line.decidedByMemberId ?? "")?.displayName ?? line.decided_by,
        }))
    }

    /** One pass over the approval requests the engine does not log: verdicts given on a thread card outside an agent's work, and every one that ran out of time. */
    private async approvalLines(workspaceId: string, filter: DecisionHistoryFilter, skip: number): Promise<Pass> {
        const page = await this.requests.resolvedPage(workspaceId, {
            department: filter.department,
            status: filter.outcome,
            skip,
            limit: filter.limit,
        })
        const linked = new Set(
            await this.threadWork.linkedRequestIds(
                workspaceId,
                page.map(({ id }) => id),
            ),
        )
        const members = await this.membersById(
            workspaceId,
            page.map((request) => request.resolvedBy),
        )
        const wanted = page.filter(
            (request) =>
                (request.status === "expired" || !linked.has(request.id)) &&
                deciderWanted(filter, deciderOf(members.get(request.resolvedBy ?? ""))),
        )
        const steps = await this.chains.threadsOfSteps(
            workspaceId,
            wanted.map(({ chainStepId }) => chainStepId),
        )
        const stepThread = new Map(steps.map((step) => [step.id, step.threadId]))
        const threadLead = new Map(
            (
                await this.threads.leadsOf(
                    workspaceId,
                    steps.map(({ threadId }) => threadId),
                )
            ).map((thread) => [thread.id, thread.leadId]),
        )
        const notes = new Map((await this.rules.list(workspaceId)).map((rule) => [rule.action, rule.note]))
        const kept = wanted.map((request): RawLine => {
            const member = members.get(request.resolvedBy ?? "")
            return {
                id: request.id,
                work_item_id: null,
                lead_id: threadLead.get(stepThread.get(request.chainStepId) ?? "") ?? null,
                department: request.department,
                action: request.action,
                decided_by: member?.displayName ?? "NIVO",
                decidedByMemberId: request.resolvedBy,
                decider_kind: deciderOf(member),
                outcome: request.status,
                reason: "over_authority",
                note: notes.get(request.action) ?? "",
                created_at: request.at.toISOString(),
                sort_key: sortKeyOf(request.at),
            }
        })
        return { scanned: page.length, kept }
    }

    /** One pass over the tasks a member completed after being tagged in a thread no agent's work runs in. */
    private async taskLines(workspaceId: string, filter: DecisionHistoryFilter, skip: number): Promise<Pass> {
        if (filter.outcome !== null && filter.outcome !== "completed") return { scanned: 0, kept: [] }
        const tasks = await this.chains.completedTasks(workspaceId, skip, filter.limit)
        const members = await this.membersById(
            workspaceId,
            tasks.map((task) => task.decidedBy),
        )
        const threadLead = new Map(
            (
                await this.threads.leadsOf(
                    workspaceId,
                    tasks.map(({ threadId }) => threadId),
                )
            ).map((thread) => [thread.id, thread.leadId]),
        )
        const working = new Set(await this.threadWork.workingThreadIds(workspaceId, [...threadLead.keys()]))
        const modules = new Map(
            (
                await this.agents.cardsOf(
                    workspaceId,
                    tasks.flatMap((task) => (task.actorKind === "agent" ? [task.actorId] : [])),
                )
            ).map((card) => [card.id, card.module]),
        )
        const kept = tasks.flatMap((task): Array<RawLine> => {
            const member = members.get(task.decidedBy)
            const department = (task.actorKind === "agent" ? modules.get(task.actorId) : undefined) ?? "office"
            if (member === undefined || !threadLead.has(task.threadId) || working.has(task.threadId)) return []
            if (!deciderWanted(filter, deciderOf(member))) return []
            if (filter.department !== null && filter.department !== department) return []
            return [
                {
                    id: task.id,
                    work_item_id: null,
                    lead_id: threadLead.get(task.threadId) ?? null,
                    department,
                    action: "thread_task",
                    decided_by: member.displayName,
                    decidedByMemberId: task.decidedBy,
                    decider_kind: deciderOf(member),
                    outcome: "completed",
                    reason: null,
                    note: task.rule ?? task.action,
                    created_at: task.at.toISOString(),
                    sort_key: sortKeyOf(task.at),
                },
            ]
        })
        return { scanned: tasks.length, kept }
    }
}
