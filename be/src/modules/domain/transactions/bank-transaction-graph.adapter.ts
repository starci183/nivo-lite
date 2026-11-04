import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TransactionEntity } from "./persistence/entities"

/** The most rows one read of the port answers. */
const READ_LIMIT = 200

/** The subject kind of a turn that is about one transaction. */
const SUBJECT_KIND = "bank-transaction"

/** The equalities of a query that the transactions table can answer, by the field names of the data kind. */
const whereOf = (query: NodeQuery): FindOptionsWhere<TransactionEntity> => {
    const { id, orderId, status, amountVnd } = query.where ?? {}
    const known = {
        id: typeof id === "string" ? id : undefined,
        orderId: typeof orderId === "string" ? orderId : undefined,
        status: typeof status === "string" ? status : undefined,
        amountVnd: typeof amountVnd === "number" ? amountVnd : undefined,
    }
    return Object.fromEntries(Object.entries(known).filter(([, value]) => value !== undefined))
}

/** A bank credit as the `bank-transaction` data kind yields it. */
const viewOf = (row: TransactionEntity): NodeRow => ({
    id: row.id,
    amountVnd: row.amountVnd,
    content: row.reference ?? "",
    counterpartName: row.payer,
    receivedAt: row.occurredAt.toISOString(),
    orderId: row.orderId,
    status: row.status,
})

@Injectable()
/**
 * The graph nodes' door to the bank feed: the data port of the `bank-transaction` kind. It serves credits only (a debit is a supplier
 * payment, never matched to an order). A `turn` read reaches the transaction the turn is about, a `workspace` read the newest of the
 * workspace.
 */
export class BankTransactionGraphAdapter implements NodeDataPort, OnModuleInit {
    readonly kind: string = SUBJECT_KIND

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port with the node host once the app has started. */
    onModuleInit(): void {
        this.registry?.addDataPort(this)
    }

    /** Reads the credits of the query, cut to its fields. */
    async read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<ReadonlyArray<NodeRow>> {
        const subject = turn.subject
        if (scope === "turn" && (subject === null || subject.kind !== SUBJECT_KIND)) return []
        const rows = await this.entityManager.find(TransactionEntity, {
            where: {
                ...whereOf(query),
                workspaceId: turn.workspaceId,
                direction: "credit",
                ...(scope === "turn" && subject !== null ? { id: subject.id } : {}),
            },
            order: { occurredAt: "DESC" },
            take: Math.min(query.limit ?? READ_LIMIT, READ_LIMIT),
        })
        return rows.map((row) => {
            const view = viewOf(row)
            return Object.fromEntries(query.fields.map((field) => [field, view[field]]))
        })
    }
}
