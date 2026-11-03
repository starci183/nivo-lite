import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { z } from "zod"
import { WorkEngineService } from "./work-engine.service"

/** The name under which a graph node raises work in the Office. */
const ACTOR = "NIVO"

/** The action of the owner decision a voided order opens; no rule is stored for it, so the owner is always asked. */
const ACTION = "order_failed_system"

const undoPayload = z.object({ id: z.string().min(1) })

@Injectable()
/**
 * The executor of the `order.void` undo, which a failed run runs for the order it recorded. The order is not deleted or cancelled: it is
 * marked `failed_system` with every field kept, and ONE work item asks the owner to deal with it, keyed by the order. Voiding an order
 * that is already `failed_system` (or gone from the workspace) does nothing.
 */
export class OrderVoidExecutorService implements OnModuleInit {
    constructor(
        private readonly orders: OrdersService,
        private readonly leads: LeadRecordsService,
        private readonly engine: WorkEngineService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({ effect: "order.void", execute: (turn, payload) => this.void(turn, payload) })
    }

    private async void(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { id } = undoPayload.parse(payload)
        const subject: SubjectRef = { kind: "order", id }
        const failed = await this.orders.markFailedSystem(turn.workspaceId, id)
        if (failed === null) return subject
        const lead = failed.lead_id === null ? null : await this.leads.find(turn.workspaceId, failed.lead_id)
        const customer = lead?.contact_name ?? failed.order_no
        await this.engine.runWork(
            { workspaceId: turn.workspaceId, actor: ACTOR, locale: turn.locale },
            {
                action: ACTION,
                subject_type: "order",
                subject_id: id,
                lead_id: failed.lead_id,
                dedupeKey: `order-void:${id}`,
                seed: {
                    summary: this.catalog.get("engine.orderFailedSystem", { customer }, turn.locale),
                    amount_vnd: failed.amount_vnd,
                    fields: { orderId: id, orderNo: failed.order_no },
                },
                preset: true,
                forceAsk: "branch_ask",
            },
        )
        return subject
    }
}
