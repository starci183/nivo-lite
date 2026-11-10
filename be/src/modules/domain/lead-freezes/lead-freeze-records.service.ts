import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { LeadFreezesError, LeadFreezesErrorCode } from "./errors/lead-freezes.error"
import { freezeOf, pendingJsonOf } from "./lead-freezes.mapper"
import { namesAnOrder } from "./lead-freeze.policy"
import type {
    FreezeSubject,
    FreezeValues,
    LeadFreeze,
    OptionalLeadFreeze,
    OptionalText,
} from "./lead-freezes.contracts"

const FREEZE = "agent.lead-freeze"
const CONVERSATION = "chat.conversation"
const LEAD = "sales.lead"
const ORDER = "sales.order"
const TRANSACTION = "payment.transaction"

/** Binds the cursor of every list of this store: none is paged past one bounded page. */
const LIST_SCOPE = "lead-freezes"

/** How often a write is tried again after another writer moved the freeze first. */
const WRITE_TRIES = 5

/** The most frozen customers one read of a workspace looks at. */
const FROZEN_PAGE = 100

/** The most orders of one customer a transfer is matched against. */
const ORDERS_PAGE = 20

const FREEZE_SELECT: ReadonlyArray<string> = [
    "key",
    "leadId",
    "conversationId",
    "status",
    "frozenRunId",
    "agentId",
    "frozenAt",
    "frozenReason",
    "stepKey",
    "stepTitle",
    "customerName",
    "workItemId",
    "episode",
    "failures",
    "heldBy",
    "releasedAt",
    "releasedBy",
    "releaseReason",
    "pending",
]

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

const BY_ID: OrderBy = [["id", "asc"]]

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** What a write of a freeze answers to build the next values from the freeze as it stands. */
export type FreezeBuild = (freeze: LeadFreeze) => FreezeValues | null

const unreadable = (): LeadFreezesError => new LeadFreezesError({ code: LeadFreezesErrorCode.RecordUnreadable })

/** The values of a write as the engine takes them: the pending events as `{ events }`, every other field as it is. */
const valuesOf = (values: FreezeValues): MutationValues => {
    const { pending, ...rest } = values
    const plain: Record<string, JsonValue> = {}
    for (const [name, value] of Object.entries(rest)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null)
            plain[name] = value
    }
    return pending === undefined ? plain : { ...plain, pending: pendingJsonOf(pending) }
}

@Injectable()
/**
 * The one place that names the freeze entity, and the few records of other capabilities a freeze reads to know who a wake is about
 * (a conversation's lead, the lead's name, a transfer and the orders it may pay). Reads are indexed queries of the entity engine; a write
 * is an engine update under the version read, read again and rebuilt when another writer moved the freeze first.
 */
export class LeadFreezeRecordsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
    ) {}

    /** Runs `work` in the scope of the workspace: in `manager`'s transaction when given, else in one of its own. */
    private at<T>(
        workspaceId: string,
        manager: EntityManager | undefined,
        work: (tx: ScopedTx) => Promise<T>,
    ): Promise<T> {
        return manager === undefined
            ? this.engine.scoped(workspaceId, work)
            : this.engine.within(manager, workspaceId, work)
    }

    /** The freeze of a customer by its key, or null. */
    byKey(workspaceId: string, key: string, manager?: EntityManager): Promise<OptionalLeadFreeze> {
        return this.at(workspaceId, manager, (tx) => this.firstWhere(tx, eq("key", key)))
    }

    /** The freeze a run froze, or null. */
    byRun(workspaceId: string, runId: string): Promise<OptionalLeadFreeze> {
        return this.at(workspaceId, undefined, (tx) => this.firstWhere(tx, eq("frozenRunId", runId)))
    }

    /** The freeze of a lead, or null. */
    byLead(workspaceId: string, leadId: string): Promise<OptionalLeadFreeze> {
        return this.at(workspaceId, undefined, (tx) => this.firstWhere(tx, eq("leadId", leadId)))
    }

    /** One freeze, or null. */
    byId(workspaceId: string, id: string): Promise<OptionalLeadFreeze> {
        return this.at(workspaceId, undefined, async (tx) => {
            const row = await this.engine.get(tx, FREEZE, id)
            return row === null ? null : freezeOf(row)
        })
    }

    /** The customers of a workspace that are frozen or being retried, oldest first, at most one page. */
    holding(workspaceId: string): Promise<ReadonlyArray<LeadFreeze>> {
        return this.at(workspaceId, undefined, async (tx) => {
            const rows = await Promise.all(
                ["frozen", "retrying"].map((status) =>
                    this.rows(tx, FREEZE, FREEZE_SELECT, eq("status", status), [
                        ["frozenAt", "asc"],
                        ["id", "asc"],
                    ]),
                ),
            )
            return rows.flat().map(freezeOf)
        })
    }

    /** The freeze of a customer, created with `create` when there is none; the unique key makes a race find the one written first. */
    ensure(workspaceId: string, subject: FreezeSubject, create: FreezeValues): Promise<LeadFreeze> {
        const values = {
            ...valuesOf(create),
            key: subject.key,
            leadId: subject.leadId,
            conversationId: subject.conversationId,
        }
        return this.at(workspaceId, undefined, async (tx) => {
            const result = await this.mutations.mutate(
                tx,
                { op: "ensure", entity: FREEZE, match: "key", values },
                "job",
            )
            if (result.ok) return freezeOf(result.row)
            const raced = await this.firstWhere(tx, eq("key", subject.key))
            if (raced === null) throw unreadable()
            return raced
        })
    }

    /**
     * Writes what `build` answers for the freeze as it stands, under the version read; when another writer moved it first, it is read and
     * built again. Answers the freeze after the write, or null when `build` answered no write. `manager` joins the caller's transaction.
     */
    patch(workspaceId: string, id: string, build: FreezeBuild, manager?: EntityManager): Promise<OptionalLeadFreeze> {
        return this.at(workspaceId, manager, (tx) => this.patchIn(tx, id, build, WRITE_TRIES))
    }

    private async patchIn(tx: ScopedTx, id: string, build: FreezeBuild, left: number): Promise<OptionalLeadFreeze> {
        if (left <= 0) throw new LeadFreezesError({ code: LeadFreezesErrorCode.Contended })
        const row = await this.engine.get(tx, FREEZE, id)
        if (row === null) throw unreadable()
        const freeze = freezeOf(row)
        const values = build(freeze)
        if (values === null) return null
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: FREEZE, key: id, expected: freeze.version, values: valuesOf(values) },
            "job",
        )
        if (result.ok) return freezeOf(result.row)
        if (result.reason === "stale") return this.patchIn(tx, id, build, left - 1)
        throw unreadable()
    }

    /** The lead a conversation is tied to, or null. */
    leadOfConversation(workspaceId: string, conversationId: string): Promise<OptionalText> {
        return this.at(workspaceId, undefined, async (tx) =>
            textOf((await this.engine.get(tx, CONVERSATION, conversationId))?.data.leadId),
        )
    }

    /** The name of a lead, or null. */
    nameOfLead(workspaceId: string, leadId: string): Promise<OptionalText> {
        return this.at(workspaceId, undefined, async (tx) =>
            textOf((await this.engine.get(tx, LEAD, leadId))?.data.contactName),
        )
    }

    /**
     * The frozen customer a bank transaction pays for: the first of `holding` with an order whose transfer code the content of the transfer
     * names. Null when the transaction names none of them, or is not there.
     */
    leadOfTransaction(
        workspaceId: string,
        transactionId: string,
        holding: ReadonlyArray<LeadFreeze>,
    ): Promise<OptionalLeadFreeze> {
        return this.at(workspaceId, undefined, async (tx) => {
            const row = await this.engine.get(tx, TRANSACTION, transactionId)
            const reference = textOf(row?.data.reference)
            if (reference === null) return null
            const leads = holding.filter((freeze) => freeze.leadId !== null)
            const orders = await Promise.all(leads.map((freeze) => this.orderNosOf(tx, freeze.leadId ?? "")))
            return leads.find((_, at) => namesAnOrder(reference, orders[at] ?? [])) ?? null
        })
    }

    /** The numbers of the newest orders of a lead. */
    private async orderNosOf(tx: ScopedTx, leadId: string): Promise<ReadonlyArray<string>> {
        const order: OrderBy = [
            ["createdAt", "desc"],
            ["id", "desc"],
        ]
        const rows = await this.rows(tx, ORDER, ["orderNo"], eq("leadId", leadId), order, ORDERS_PAGE)
        return rows.flatMap((row) => textOf(row.data.orderNo) ?? [])
    }

    private async firstWhere(tx: ScopedTx, where: FilterExpr): Promise<OptionalLeadFreeze> {
        const rows = await this.rows(tx, FREEZE, FREEZE_SELECT, where, BY_ID, 1)
        const row = rows.at(0)
        return row === undefined ? null : freezeOf(row)
    }

    private async rows(
        tx: ScopedTx,
        from: string,
        select: ReadonlyArray<string>,
        where: FilterExpr,
        order: OrderBy,
        size: number = FROZEN_PAGE,
    ): Promise<ReadonlyArray<RecordRow>> {
        const page = await this.engine.list(tx, { from, select, where, order, page: { size } }, LIST_SCOPE)
        return page.rows.map((row) => row.row)
    }
}
