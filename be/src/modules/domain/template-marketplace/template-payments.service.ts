import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentTemplateVersionsService, TemplateLicenseEntity } from "@modules/domain/agent-templates"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaidOrderFulfilment } from "@modules/domain/sepay-transactions"
import { CreatorLedgerEntryEntity, TemplateListingEntity } from "./persistence/entities"
import { splitOf } from "./policies/revenue.policy"

@Injectable()
/**
 * What a settled order for a paid listing writes, in the transaction that settled it: the license of the workspace and two ledger lines
 * (the creator share and the fee of the platform). Both are keyed by the order, so a delivery that is processed twice writes nothing
 * twice. Paying out is manual and happens outside the app: the ledger only says what is owed.
 */
export class TemplatePaymentsService implements PaidOrderFulfilment {
    constructor(
        private readonly orders: PaymentOrdersService,
        private readonly versions: AgentTemplateVersionsService,
    ) {}

    /** Fulfils the order with this code if it buys a listing; any other order is left alone. */
    async fulfil(manager: EntityManager, orderCode: string): Promise<void> {
        const order = await this.orders.findByCode(orderCode, manager)
        if (order?.kind !== "agent_template" || order.status !== "paid") return
        const listingId = String(order.detail["listingId"] ?? "")
        const listing = await manager.findOne(TemplateListingEntity, { where: { id: listingId } })
        if (listing === null) return
        const template = await this.versions.templateOf(listing.templateKey)
        if (template === null) return
        const already = await manager.findOne(TemplateLicenseEntity, { where: { orderId: order.id } })
        if (already !== null) return
        await manager.insert(TemplateLicenseEntity, {
            workspaceId: order.workspaceId,
            templateKey: listing.templateKey,
            kind: "paid",
            listingId: listing.id,
            orderId: order.id,
            installationId: null,
            status: "active",
        })
        const split = splitOf(order.amountVnd, listing.revenueSharePct)
        const base = {
            creatorAccountId: template.creatorAccountId,
            templateKey: listing.templateKey,
            listingId: listing.id,
            orderId: order.id,
            workspaceId: order.workspaceId,
        }
        await manager.insert(CreatorLedgerEntryEntity, [
            { ...base, kind: "creator_share", amountVnd: split.creator },
            { ...base, kind: "platform_fee", amountVnd: split.platform },
        ])
    }
}
