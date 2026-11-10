import { Injectable, Optional } from "@nestjs/common"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { LeadMemoryService, leadMemorySubjectOf } from "@modules/domain/lead-memory"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { ContextAudience, ContextFact, ContextResult, ContextRow, LockedSubject } from "./context-sources.contracts"
import {
    CONTEXT_NOTICE,
    CONVERSATION_ENTITY,
    LEAD_ENTITY,
    leadFieldsOf,
    lineFactOf,
    notesFor,
    orderFieldsOf,
    ordersQueryOf,
    recordFactOf,
    threadQueryOf,
} from "./context-sources.policy"
import type { MemoryNote } from "./context-sources.policy"

/** The cursor scope of every context list (one page each, never paged further). */
const READ_SCOPE = cursorScopeOf("context-sources.read", {}, "id")

@Injectable()
/**
 * The reads behind the context sources, each served by an index of the entity it reads (proved against the real declarations): the
 * thread of one conversation, the record, the latest orders and the remembered facts and notes of one customer. They answer for the
 * subject the caller fixed (the door fixes it from the run token: the run's own conversation and customer, never another) and for the
 * audience of the caller: a customer-facing run reads the customer's own facts only, no shop-internal field. Every read answers the one
 * result shape of a context source (notice, source, as of, facts). The lead memory is optional: an app without it (the mcp app) reads
 * the record alone.
 */
export class ContextReadsService {
    constructor(
        private readonly engine: EntityEngineService,
        @InjectClock() private readonly clock: Clock,
        @Optional() private readonly memory?: LeadMemoryService,
    ) {}

    /** The customer a conversation names, or null when it names none or does not exist. One read by id. */
    async leadOfConversation(workspaceId: string, conversationId: string): Promise<string | null> {
        const row = await this.engine.scoped(workspaceId, (tx) => this.engine.get(tx, CONVERSATION_ENTITY, conversationId))
        const leadId = row?.data.leadId
        return typeof leadId === "string" && leadId !== "" ? leadId : null
    }

    /** The latest lines of the subject's conversation, newest first; none when the run serves no conversation. */
    async thread(workspaceId: string, subject: LockedSubject, limit: number): Promise<ContextResult> {
        const { conversationId } = subject
        if (conversationId === null) return this.resultOf("nivo.conversation", [])
        const rows = await this.list(workspaceId, threadQueryOf(conversationId, limit))
        return this.resultOf(
            "nivo.conversation",
            rows.flatMap((row) => {
                const fact = lineFactOf(row)
                return fact === null ? [] : [fact]
            }),
        )
    }

    /** The subject's customer record (the fields of the audience) and the facts the workflows proved; none for a run with no customer. */
    async profile(workspaceId: string, subject: LockedSubject, audience: ContextAudience): Promise<ContextResult> {
        const { leadId } = subject
        if (leadId === null) return this.resultOf("nivo.lead", [])
        const [row, snapshot] = await Promise.all([
            this.engine.scoped(workspaceId, (tx) => this.engine.get(tx, LEAD_ENTITY, leadId)),
            this.memory?.snapshot(workspaceId, leadMemorySubjectOf(leadId, subject.conversationId), "step") ?? null,
        ])
        if (row === null) return this.resultOf("nivo.lead", [])
        const record = recordFactOf({ id: row.id, data: row.data, createdAt: row.createdAt }, leadFieldsOf(audience))
        return this.resultOf("nivo.lead", [{ ...record, remembered: snapshot?.lead ?? {} }])
    }

    /** The latest orders of the subject's customer, newest first, with the fields of the audience; none for a run with no customer. */
    async orders(workspaceId: string, subject: LockedSubject, audience: ContextAudience, limit: number): Promise<ContextResult> {
        const { leadId } = subject
        if (leadId === null) return this.resultOf("nivo.lead", [])
        const fields = orderFieldsOf(audience)
        const rows = await this.list(workspaceId, ordersQueryOf(leadId, fields, limit))
        return this.resultOf(
            "nivo.lead",
            rows.map((row) => recordFactOf(row, fields)),
        )
    }

    /** What the workflow steps noted about the subject's customer, newest first; none without a customer or a lead memory. */
    async notes(workspaceId: string, subject: LockedSubject, audience: ContextAudience, limit: number): Promise<ContextResult> {
        const { leadId } = subject
        if (leadId === null || this.memory === undefined) return this.resultOf("nivo.lead", [])
        const snapshot = await this.memory.snapshot(workspaceId, leadMemorySubjectOf(leadId, subject.conversationId), "step")
        const notes = Object.entries(snapshot?.workflows ?? {}).flatMap(([workflow, steps]) =>
            Object.entries(steps).map(
                ([step, memory]): MemoryNote => ({
                    workflow,
                    step,
                    status: memory.status,
                    at: memory.at,
                    output: memory.output,
                }),
            ),
        )
        return this.resultOf("nivo.lead", notesFor(notes, audience, limit))
    }

    /** One page of a query, as rows with their id, data and creation time. */
    private async list(workspaceId: string, query: Query): Promise<ReadonlyArray<ContextRow>> {
        const page = await this.engine.scoped(workspaceId, (tx) => this.engine.list(tx, query, READ_SCOPE))
        return page.rows.map(({ row }) => ({ id: row.id, data: row.data, createdAt: row.createdAt }))
    }

    /** The one result shape of a context read. */
    private resultOf(source: string, facts: ReadonlyArray<ContextFact>): ContextResult {
        return { notice: CONTEXT_NOTICE, source, asOf: this.clock.now().toISOString(), facts }
    }
}
