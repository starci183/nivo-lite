import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ApprovalGate, OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { LoadedPo, SendKind, SendRequestResult } from "./inventory.contracts"
import type { RequestSendOutput, RequestSendParams } from "./inventory-operations.contracts"
import { InventoryOrderMessageService } from "./inventory-order-message.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import { fieldText } from "./policies/gate-fields.policy"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { isEmailAddress } from "./policies/input-text.policy"
import { formatMoney } from "./policies/number-format.policy"
import { WorkItemsDecisionsReadService } from "@modules/domain/work-items"

@Injectable()
/**
 * Sending an order to its supplier: the owner is asked first, then the order goes by email or becomes a copy-ready
 * message.
 */
export class InventoryDispatchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly gate: ApprovalGate,
        private readonly mail: OutboundMail,
        private readonly orders: InventoryOrdersService,
        private readonly messages: InventoryOrderMessageService,
        private readonly decisions: WorkItemsDecisionsReadService,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** Puts a draft order (or a reminder for a sent one) before the owner. */
    async requestSend(userId: string, workspaceId: string, request: RequestSendParams): Promise<RequestSendOutput> {
        const { displayName: actor } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const result = await this.askToSend(workspaceId, actor, request.poId, request.kind)
        return { status: result.status }
    }

    /**
     * Writes the order message, asks the gate to decide `send_purchase_order` and, when the owner must decide, parks
     * the order as waiting for approval. A repeated call while a decision waits changes nothing.
     */
    async askToSend(workspaceId: string, actor: string, poId: string, kind: SendKind): Promise<SendRequestResult> {
        const po = await this.orders.loadPo(workspaceId, poId)
        if (po.supplierId === null || po.supplier === null) {
            throw new InventoryError({ code: InventoryErrorCode.PoSupplierRequired })
        }
        if (po.lines.length === 0) throw new InventoryError({ code: InventoryErrorCode.PoEmpty })
        const sendable =
            kind === "order" ? po.status === "draft" : po.status === "sent" || po.status === "partially_received"
        if (!sendable) return { status: po.status, workItemId: null }
        const { text } = await this.messages.compose(workspaceId, po, kind)
        const attempt = (await this.decisions.countWithKeyPrefix(workspaceId, `send_po:${kind}:${po.id}:`)) + 1
        const total = Math.round(po.totalVnd)
        if (kind === "order") await callDbFunction(this.entityManager, "public.inventory_set_po_message", [po.id, text])
        const verdict = await this.gate.request({
            workspaceId,
            actor,
            action: "send_purchase_order",
            subjectType: "purchase_order",
            subjectId: po.id,
            dedupeKey: `send_po:${kind}:${po.id}:${attempt}`,
            summary: this.text(kind === "order" ? "inventory.sendAskSummary" : "inventory.remindAskSummary", {
                poNo: po.poNo,
                supplier: po.supplier.name,
                count: po.lines.length,
                total: formatMoney(total),
            }),
            draft: text,
            amountVnd: total,
            fields: {
                po_id: po.id,
                po_no: po.poNo,
                supplier: po.supplier.name,
                channel: po.supplier.channel,
                kind,
                amount_vnd: total,
            },
        })
        if (kind === "order" && verdict.status === "waiting_decision") {
            await callDbFunction(this.entityManager, "public.inventory_mark_po_waiting", [po.id, verdict.workItemId])
        }
        return { status: verdict.status, workItemId: verdict.workItemId }
    }

    /**
     * The performer of the send_purchase_order action: the order or the reminder goes to the supplier, by email or as a
     * copy-ready message.
     */
    async performSendPurchaseOrder(context: PerformContext): Promise<PerformResult> {
        const po = await this.orders.loadPo(context.workspaceId, fieldText(context.fields, "po_id"))
        const reminder = fieldText(context.fields, "kind") === "reminder"
        if (!isDispatchableStatus(po.status, reminder)) {
            return {
                summary: this.text("inventory.poAlreadyHandled", { poNo: po.poNo, status: po.status }),
                evidence: "pending",
            }
        }
        const message = (context.draft ?? po.message).trim()
        if (message === "") throw new InventoryError({ code: InventoryErrorCode.PoMessageEmpty })
        const supplier = po.supplier
        const { via, note } = await this.deliverOrder(context, po, reminder, message)
        const who = supplier?.name ?? this.text("inventory.supplierFallback", {})
        const channelWord = this.text(`inventory.channelWord.${supplier?.channel ?? "email"}`, {})
        if (reminder) {
            await callDbFunction(this.entityManager, "public.inventory_mark_po_reminded", [
                po.id,
                via === "copy" ? (note ?? this.text("inventory.reminderCopyNote", { channel: channelWord })) : null,
            ])
        } else {
            await callDbFunction(this.entityManager, "public.inventory_mark_po_sent", [
                po.id,
                via,
                message,
                context.workItemId,
                via === "copy" ? (note ?? this.text("inventory.sentCopyNote", { channel: channelWord, who })) : null,
            ])
        }
        const sentLine = this.text("inventory.sentByEmailSummary", {
            what: this.text(reminder ? "inventory.sentReminderWord" : "inventory.sentOrderWord", {}),
            poNo: po.poNo,
            who,
        })
        const copyWord = this.text(reminder ? "inventory.copyReminderWord" : "inventory.copyOrderWord", {})
        await this.office.logEvidence(context.workspaceId, {
            kind: reminder ? "inventory.po_reminder" : "inventory.po_sent",
            actor: context.actor,
            summary:
                via === "email"
                    ? sentLine
                    : this.text("inventory.approvedCopySummary", {
                          what: copyWord,
                          poNo: po.poNo,
                          who,
                          channel: channelWord,
                      }),
            evidence: note,
            workItemId: context.workItemId,
        })
        const copyResult = this.text("inventory.approvedCopyResult", {
            what: copyWord,
            poNo: po.poNo,
            who,
            channel: channelWord,
            note: note === null ? "" : ` (${note})`,
        })
        return {
            summary: via === "email" ? sentLine : copyResult,
            evidence: via === "email" ? "captured" : "pending",
            href: "/agents/inventory/workbench?tab=orders",
            detail: message,
        }
    }

    /**
     * The owner refused the send: the order goes back to a draft they can edit or cancel; a refused reminder needs no
     * cleanup.
     */
    async rejectSendPurchaseOrder(context: PerformContext): Promise<void> {
        if (fieldText(context.fields, "kind") === "reminder") return
        await callDbFunction(this.entityManager, "public.inventory_refuse_po", [
            context.workspaceId,
            fieldText(context.fields, "po_id"),
            this.text("inventory.refusedNote", {}),
        ])
    }

    private async deliverOrder(
        context: PerformContext,
        po: LoadedPo,
        reminder: boolean,
        message: string,
    ): Promise<{ via: "email" | "copy"; note: string | null }> {
        const supplier = po.supplier
        const email =
            supplier?.channel === "email" && supplier.email !== null && isEmailAddress(supplier.email.trim())
                ? supplier.email.trim()
                : null
        let via: "email" | "copy" = "copy"
        let note: string | null = null
        if (email !== null) {
            const shop = await this.office.workspaceName(context.workspaceId)
            const subject = this.text(reminder ? "inventory.reminderSubject" : "inventory.orderSubject", {
                shop,
                poNo: po.poNo,
            })
            const sent = await this.mail.send({
                workspaceId: context.workspaceId,
                to: email,
                subject,
                title: subject,
                body: message,
                purpose: reminder ? "inventory_po_reminder" : "inventory_po",
                audience: "customer",
                refs: { po_id: po.id, po_no: po.poNo },
                workItemId: context.workItemId,
            })
            if (sent.status === "sent") via = "email"
            else note = sent.error ?? this.text("inventory.emailNotSent", {})
        } else if (supplier?.channel === "email") {
            note = this.text("inventory.supplierEmailMissing", {})
        }
        return { via, note }
    }
}

/** Reminders retain their existing status path; initial sends require an unsent order. */
const isDispatchableStatus = (status: string, reminder: boolean): boolean =>
    reminder || status === "waiting_approval" || status === "draft"
