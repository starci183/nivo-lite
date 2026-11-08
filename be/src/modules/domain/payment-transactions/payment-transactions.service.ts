import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type {
    MovementQuery,
    MovementRow,
    OptionalRecordedMovement,
    PaymentMovement,
} from "./payment-transactions.contracts"

const TRANSACTION = "payment.transaction"

/** The fields a read of the movements selects. */
const ROW_FIELDS: ReadonlyArray<string> = ["amountVnd", "reference", "payer", "status", "occurredAt"]

const equals = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

const movementOf = (row: RecordRow): MovementRow => {
    const amount = row.data["amountVnd"]
    return {
        id: row.id,
        amountVnd: typeof amount === "number" ? amount : 0,
        reference: textOf(row.data["reference"]),
        payer: textOf(row.data["payer"]),
        status: textOf(row.data["status"]) ?? "unmatched",
        occurredAt: textOf(row.data["occurredAt"]) ?? row.createdAt,
    }
}

@Injectable()
/**
 * The bank movements of a workspace as `payment.transaction` records. The bank feed records a movement inside its own transaction, once
 * per provider transaction id (the declared match key `external_ref`), and the SePay tool reads them back; nothing here touches the
 * legacy `public.transactions`.
 */
export class PaymentTransactionsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Records a movement on the caller's transaction; a repeat of the same provider transaction answers the same record with `created` false. Null when the engine refused it. */
    record(manager: EntityManager, workspaceId: string, movement: PaymentMovement): Promise<OptionalRecordedMovement> {
        return this.engine.within(manager, workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const made = await api.ensure(TRANSACTION, "external_ref", {
                channel: "bank",
                direction: movement.direction,
                amountVnd: movement.amountVnd,
                reference: movement.reference,
                payer: movement.payer,
                externalRef: movement.externalRef,
                account: movement.account,
                occurredAt: movement.occurredAt ?? this.clock.now().toISOString(),
                status: "unmatched",
            })
            return made.ok ? { id: made.row.id, created: made.created === true } : null
        })
    }

    /** The newest movements of the workspace in the direction asked, narrowed by status and start. */
    list(workspaceId: string, query: MovementQuery): Promise<ReadonlyArray<MovementRow>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const filters: Array<FilterExpr> = [
                equals("direction", query.direction),
                ...(query.status === null ? [] : [equals("status", query.status)]),
                ...(query.since === null
                    ? []
                    : [{ op: "gte", field: "occurredAt", value: query.since } satisfies FilterExpr]),
            ]
            const page = await api.list({
                from: TRANSACTION,
                select: ROW_FIELDS,
                where: { op: "and", of: filters },
                order: [
                    ["occurredAt", "desc"],
                    ["id", "desc"],
                ],
                page: { size: query.limit },
            })
            return page.rows.map((listed) => movementOf(listed.row))
        })
    }
}
