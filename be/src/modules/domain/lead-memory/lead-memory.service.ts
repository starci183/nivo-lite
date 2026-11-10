import { Injectable } from "@nestjs/common"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { maskSnapshot } from "@nivo-lite/agent-sdk/node"
import type { LeadMemoryStore, MemoryReader, MemorySubject, MemoryWrite } from "@nivo-lite/agent-sdk/node"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import { QUERY_BOUNDS } from "@nivo-lite/agent-sdk/query"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { LeadMemoryError, LeadMemoryErrorCode } from "./errors/lead-memory.error"
import type { OptionalSnapshot, OptionalStepMemory, SensitiveOf } from "./lead-memory.contracts"
import {
    CONVERSATION_KEY,
    entryKeyOf,
    expiresAtOf,
    FACTS_NODE,
    factsValuesOf,
    isJsonRecord,
    jsonOf,
    LEAD_KEY,
    LEAD_NAMESPACE,
    leadMemorySubjectOf,
    snapshotOf,
    stepMemoryOfRow,
    stepValuesOf,
    triggerValuesOf,
    valueOfRow,
} from "./lead-memory.policy"

const MEMORY = "agent.lead-memory"
const LEAD = "sales.lead"

/** Binds the cursor of every list of this store. */
const LIST_SCOPE = "lead-memory"

/** The unique constraint an entry is upserted on. */
const ENTRY_UNIQUE = "entry_key"

/** The most entries of one customer a read takes: one per node of every workflow, far fewer in practice. */
const ENTRIES_PAGE = 500

/** The most entries one sweep deletes. */
const SWEEP_PAGE = 200

/** What one list asks: the filter and the order, which must follow an index of the entity. */
interface ListFilter {
    /** The rows asked for. */
    readonly where: FilterExpr
    /** Their order. */
    readonly order: OrderBy
}

/** Every list in id order, the tail of each index of the entity. */
const BY_ID: OrderBy = [["id", "asc"]]

/** The sweep in the order of its index: the oldest expiry first. */
const BY_EXPIRY: OrderBy = [
    ["expiresAt", "asc"],
    ["id", "asc"],
]

/** How often the facts are written again after another writer moved them first. */
const WRITE_TRIES = 5

const SELECT: ReadonlyArray<string> = [
    "entryKey",
    "subjectKey",
    "leadId",
    "conversationId",
    "namespace",
    "nodeKey",
    "step",
    "kind",
    "agentId",
    "workflowId",
    "runId",
    "versionId",
    "output",
    "error",
    "writtenAt",
    "closedAt",
    "expiresAt",
]

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

/** The values of an entry as they stand, to write it again under another customer or another expiry. */
const valuesOfRow = (row: RecordRow): MutationValues =>
    Object.fromEntries(SELECT.map((name) => [name, jsonOf(row.data[name])]))

@Injectable()
/**
 * The one memory of each customer (`LeadMemoryStore`), across every workflow and run of theirs, on the `agent.lead-memory` entity: one
 * entry per (customer, workflow namespace, node) with the latest outcome of that node, one trigger entry per workflow and one facts entry
 * per customer. A step reads the raw snapshot; display reads it masked. Resume asks `stepOf` before it runs a node, so a step that already
 * has an outcome in this run is never run (nor its AI called) again.
 */
export class LeadMemoryService implements LeadMemoryStore {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The snapshot of a customer: the entries under their lead and under their conversation, and their lead record. */
    async snapshot(workspaceId: string, subject: MemorySubject, reader: MemoryReader): Promise<OptionalSnapshot> {
        return this.snapshotWith(workspaceId, subject, reader, () => ({}))
    }

    /** The snapshot as `snapshot` reads it, masking for display by the sensitive members each node declared. */
    async snapshotWith(
        workspaceId: string,
        subject: MemorySubject,
        reader: MemoryReader,
        sensitiveOf: SensitiveOf,
    ): Promise<OptionalSnapshot> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const rows = await this.rowsOfSubject(tx, subject)
            const lead = subject.leadId === null ? null : await this.engine.get(tx, LEAD, subject.leadId)
            if (rows.length === 0 && lead === null) return null
            const snapshot = snapshotOf(subject, rows, lead)
            return reader === "display" ? maskSnapshot(snapshot, sensitiveOf) : snapshot
        })
    }

    /** The outcome one node had in one run, or null: what resume and replay return instead of running it again. */
    async stepOf(workspaceId: string, subject: MemorySubject, runId: string, nodeKey: string): Promise<OptionalStepMemory> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const where: FilterExpr = { op: "and", of: [eq("runId", runId), eq("nodeKey", nodeKey)] }
            const rows = await this.rows(tx, where, 5)
            const keys = this.keysOf(subject)
            const row = rows.find((candidate) => keys.includes(String(candidate.data.subjectKey))) ?? rows.at(0)
            return row === undefined ? null : stepMemoryOfRow(row)
        })
    }

    /**
     * Lays facts over the customer's facts entry, outside any step (what `nivo.lead.update` says the consult learned): only lead facts are
     * kept (`LEAD_FACTS`), the newest value wins, another writer is waited out a few times.
     */
    async remember(
        workspaceId: string,
        subject: MemorySubject,
        facts: Readonly<Record<string, JsonValue>>,
    ): Promise<void> {
        if (Object.keys(facts).length === 0) return
        await this.engine.scoped(workspaceId, (tx) => this.mergeFacts(tx, subject, facts, WRITE_TRIES))
    }

    /** Writes one step's outcome, the run's trigger under its workflow, and the facts it proves; a repeat writes the same values again. */
    async write(workspaceId: string, write: MemoryWrite): Promise<void> {
        const now = this.clock.now()
        await this.engine.scoped(workspaceId, async (tx) => {
            await this.upsert(tx, stepValuesOf(write, now))
            await this.upsert(tx, triggerValuesOf(write, now))
            if (Object.keys(write.facts).length > 0) await this.mergeFacts(tx, write.subject, write.facts, WRITE_TRIES)
        })
    }

    /** Moves the entries of a conversation to the lead it became: written again under the lead (the lead's own win), then removed. */
    async adopt(workspaceId: string, conversationId: string, leadId: string): Promise<void> {
        const from = `${CONVERSATION_KEY}${conversationId}`
        const to = leadMemorySubjectOf(leadId, conversationId)
        const now = this.clock.now()
        await this.engine.scoped(workspaceId, async (tx) => {
            const moving = await this.rows(tx, eq("subjectKey", from), ENTRIES_PAGE)
            await eachInOrder(moving, async (row) => {
                const namespace = String(row.data.namespace)
                const nodeKey = String(row.data.nodeKey)
                if (namespace === LEAD_NAMESPACE && nodeKey === FACTS_NODE) {
                    const value = valueOfRow(row)
                    if (isJsonRecord(value)) await this.mergeFacts(tx, to, value, WRITE_TRIES, true)
                } else {
                    const key = entryKeyOf(to.key, namespace, nodeKey)
                    const taken = await this.rows(tx, eq("entryKey", key), 1)
                    if (taken.length === 0)
                        await this.upsert(tx, {
                            ...valuesOfRow(row),
                            entryKey: key,
                            subjectKey: to.key,
                            leadId,
                            conversationId,
                            expiresAt: expiresAtOf(to, now, null).toISOString(),
                        })
                }
                await this.mutations.mutate(tx, { op: "delete", entity: MEMORY, key: row.id }, "job")
            })
        })
    }

    /** Marks the lead closed: every entry of theirs now goes 30 days after `at`. */
    async closed(workspaceId: string, leadId: string, at: Date): Promise<void> {
        const subject = leadMemorySubjectOf(leadId, null)
        const expiresAt = expiresAtOf(subject, at, at).toISOString()
        await this.engine.scoped(workspaceId, async (tx) => {
            const rows = await this.rows(tx, eq("subjectKey", subject.key), ENTRIES_PAGE)
            await eachInOrder(rows, (row) =>
                this.upsert(tx, { ...valuesOfRow(row), closedAt: at.toISOString(), expiresAt }),
            )
        })
    }

    /** Deletes one page of the entries whose retention ran out; answers how many went. */
    async sweep(workspaceId: string, now: Date): Promise<number> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const due = await this.rows(tx, { op: "lt", field: "expiresAt", value: now.toISOString() }, SWEEP_PAGE, BY_EXPIRY)
            await eachInOrder(due, async (row) => {
                await this.mutations.mutate(tx, { op: "delete", entity: MEMORY, key: row.id }, "job")
            })
            return due.length
        })
    }

    /** The keys a customer's entries may sit under: their lead, then their conversation. */
    private keysOf(subject: MemorySubject): ReadonlyArray<string> {
        return [
            subject.key,
            ...(subject.leadId === null ? [] : [`${LEAD_KEY}${subject.leadId}`]),
            ...(subject.conversationId === null ? [] : [`${CONVERSATION_KEY}${subject.conversationId}`]),
        ]
    }

    private async rowsOfSubject(tx: ScopedTx, subject: MemorySubject): Promise<ReadonlyArray<RecordRow>> {
        const keys = [...new Set(this.keysOf(subject))]
        const pages = await Promise.all(keys.map((key) => this.rows(tx, eq("subjectKey", key), ENTRIES_PAGE)))
        return pages.flat()
    }

    private async upsert(tx: ScopedTx, values: MutationValues): Promise<void> {
        await this.mutations.mutate(tx, { op: "upsert", entity: MEMORY, on: ENTRY_UNIQUE, values }, "job")
    }

    /** Lays `facts` over the facts entry of the customer under the version read; `under` keeps what the entry holds over them. */
    private async mergeFacts(
        tx: ScopedTx,
        subject: MemorySubject,
        facts: Readonly<Record<string, JsonValue>>,
        left: number,
        under: boolean = false,
    ): Promise<void> {
        if (left <= 0) throw new LeadMemoryError({ code: LeadMemoryErrorCode.Contended })
        const now = this.clock.now()
        const key = entryKeyOf(subject.key, LEAD_NAMESPACE, FACTS_NODE)
        const [row] = await this.rows(tx, eq("entryKey", key), 1)
        if (row === undefined) {
            await this.upsert(tx, factsValuesOf(subject, {}, facts, now))
            return
        }
        const held = valueOfRow(row)
        const before = isJsonRecord(held) ? held : {}
        const values = under ? factsValuesOf(subject, facts, before, now) : factsValuesOf(subject, before, facts, now)
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: MEMORY, key: row.id, expected: row.version, values },
            "job",
        )
        if (!result.ok && result.reason === "stale") await this.mergeFacts(tx, subject, facts, left - 1, under)
    }

    /**
     * The rows that match, at most `limit`, read page by page within the engine's page bound (`QUERY_BOUNDS.pageSize`): a customer with
     * more entries than one page holds is read in full, never refused for its size.
     */
    private async rows(
        tx: ScopedTx,
        where: FilterExpr,
        limit: number,
        order: OrderBy = BY_ID,
    ): Promise<ReadonlyArray<RecordRow>> {
        return this.pagesFrom(tx, { where, order }, limit, undefined)
    }

    private async pagesFrom(
        tx: ScopedTx,
        filter: ListFilter,
        left: number,
        after: string | undefined,
    ): Promise<ReadonlyArray<RecordRow>> {
        const size = Math.min(left, QUERY_BOUNDS.pageSize)
        const page = await this.engine.list(
            tx,
            {
                from: MEMORY,
                select: SELECT,
                where: filter.where,
                order: filter.order,
                page: after === undefined ? { size } : { size, after },
            },
            LIST_SCOPE,
        )
        const rows = page.rows.map((row) => row.row)
        if (page.next === null || rows.length >= left) return rows.slice(0, left)
        return [...rows, ...(await this.pagesFrom(tx, filter, left - rows.length, page.next))]
    }
}
