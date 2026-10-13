import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryErrorCode } from "./errors/inventory.error"
import type { LoadedPo } from "./inventory.contracts"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryOrderMessageService } from "./inventory-order-message.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import {
    COUNT_SEND_ATTEMPTS,
    MARK_PO_REMINDED,
    MARK_PO_SENT,
    MARK_PO_WAITING,
    REFUSE_PO,
    SET_PO_MESSAGE,
} from "./persistence/inventory.sql"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const poOf = (overrides: Partial<LoadedPo> = {}): LoadedPo => ({
    id: "po-1",
    poNo: "PO-202610-0001",
    supplierId: "sup-1",
    status: "draft",
    totalVnd: 60000.4,
    expectedAt: null,
    message: "stored message",
    reminders: 0,
    supplier: { name: "Mill Co", contactName: "Huong", email: " orders@mill.vn ", channel: "email", leadTimeDays: 2 },
    lines: [
        {
            id: "line-1",
            itemId: "item-1",
            qtyOrdered: 10,
            qtyReceived: 0,
            unitCost: 6000,
            itemName: "Tea",
            itemUnit: "kg",
        },
    ],
    ...overrides,
})

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Quan Cafe")
    const gate = mock<ApprovalGate>()
    const mail = mock<OutboundMail>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const orders = mock<InventoryOrdersService>()
    orders.loadPo.mockResolvedValue(poOf())
    const messages = mock<InventoryOrderMessageService>()
    messages.compose.mockResolvedValue({ text: "Dear Huong", generated: true })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryDispatchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: ApprovalGate, useValue: gate },
            { provide: OutboundMail, useValue: mail },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InventoryOrdersService, useValue: orders },
            { provide: InventoryOrderMessageService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryDispatchService), office, gate, mail, members, orders, messages }
}

describe("InventoryDispatchService", () => {
    describe("requestSend", () => {
        it("puts a draft order before the owner and parks it as waiting", async () => {
            const em = mockEntityManager({
                query: [
                    [COUNT_SEND_ATTEMPTS, [{ attempts: 1 }]],
                    [SET_PO_MESSAGE, []],
                    [MARK_PO_WAITING, []],
                ],
            })
            const { service, gate, members } = await build(em)
            gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })

            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "order" })).resolves.toEqual({
                status: "waiting_decision",
            })

            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(COUNT_SEND_ATTEMPTS, ["ws-1", "send_po:order:po-1:%"])
            expect(em.query).toHaveBeenCalledWith(SET_PO_MESSAGE, ["po-1", "Dear Huong"])
            expect(gate.request).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                actor: "Lan",
                action: "send_purchase_order",
                subjectType: "purchase_order",
                subjectId: "po-1",
                dedupeKey: "send_po:order:po-1:2",
                summary: text("inventory.sendAskSummary", {
                    poNo: "PO-202610-0001",
                    supplier: "Mill Co",
                    count: 1,
                    total: "60.000 ₫",
                }),
                draft: "Dear Huong",
                amountVnd: 60000,
                fields: {
                    po_id: "po-1",
                    po_no: "PO-202610-0001",
                    supplier: "Mill Co",
                    channel: "email",
                    kind: "order",
                    amount_vnd: 60000,
                },
            })
            expect(em.query).toHaveBeenCalledWith(MARK_PO_WAITING, ["po-1", "work-1"])
        })

        it("leaves the order a draft when the gate let it through at once", async () => {
            const em = mockEntityManager({
                query: [
                    [COUNT_SEND_ATTEMPTS, []],
                    [SET_PO_MESSAGE, []],
                ],
            })
            const { service, gate } = await build(em)
            gate.request.mockResolvedValue({ status: "done", workItemId: "work-1" })

            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "order" })).resolves.toEqual({
                status: "done",
            })

            expect(em.query).not.toHaveBeenCalledWith(MARK_PO_WAITING, expect.anything())
        })

        it("asks for a reminder of a sent order without rewriting its message", async () => {
            const em = mockEntityManager({ query: [COUNT_SEND_ATTEMPTS, [{ attempts: 0 }]] })
            const { service, gate, orders } = await build(em)
            orders.loadPo.mockResolvedValue(poOf({ status: "partially_received" }))
            gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-2" })

            await service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "reminder" })

            expect(gate.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    dedupeKey: "send_po:reminder:po-1:1",
                    summary: expect.stringContaining("inventory.remindAskSummary"),
                }),
            )
            expect(em.query).toHaveBeenCalledTimes(1)
        })

        it("asks for a reminder only for an order that was sent", async () => {
            const { service, gate, orders } = await build(mockEntityManager({ query: [COUNT_SEND_ATTEMPTS, []] }))
            orders.loadPo.mockResolvedValue(poOf({ status: "sent" }))
            gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-2" })

            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "reminder" })).resolves.toEqual({
                status: "waiting_decision",
            })
        })

        it("answers the current status without asking when the order is not in the right state", async () => {
            const { service, gate, orders } = await build(mockEntityManager())
            orders.loadPo
                .mockResolvedValueOnce(poOf({ status: "waiting_approval" }))
                .mockResolvedValueOnce(poOf({ status: "draft" }))

            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "order" })).resolves.toEqual({
                status: "waiting_approval",
            })
            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "reminder" })).resolves.toEqual({
                status: "draft",
            })

            expect(gate.request).not.toHaveBeenCalled()
        })

        it("refuses an order without a supplier or without lines", async () => {
            const { service, orders } = await build(mockEntityManager())
            orders.loadPo
                .mockResolvedValueOnce(poOf({ supplierId: null, supplier: null }))
                .mockResolvedValueOnce(poOf({ supplierId: "sup-1", supplier: null }))
                .mockResolvedValueOnce(poOf({ lines: [] }))

            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "order" })).rejects.toMatchObject({
                code: InventoryErrorCode.PoSupplierRequired,
            })
            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "order" })).rejects.toMatchObject({
                code: InventoryErrorCode.PoSupplierRequired,
            })
            await expect(service.requestSend("user-1", "ws-1", { poId: "po-1", kind: "order" })).rejects.toMatchObject({
                code: InventoryErrorCode.PoEmpty,
            })
        })
    })

    describe("performSendPurchaseOrder", () => {
        const context = {
            workspaceId: "ws-1",
            workItemId: "work-1",
            actor: "Lan",
            draft: "  Dear Huong  ",
            fields: { po_id: "po-1", kind: "order" },
        }

        it("sends the order by email and marks it sent", async () => {
            const em = mockEntityManager({ query: [MARK_PO_SENT, []] })
            const { service, mail, office, orders } = await build(em)
            orders.loadPo.mockResolvedValue(poOf({ status: "waiting_approval" }))
            mail.send.mockResolvedValue({ status: "sent" })

            const result = await service.performSendPurchaseOrder(context)

            expect(mail.send).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                to: "orders@mill.vn",
                subject: text("inventory.orderSubject", { shop: "Quan Cafe", poNo: "PO-202610-0001" }),
                title: text("inventory.orderSubject", { shop: "Quan Cafe", poNo: "PO-202610-0001" }),
                body: "Dear Huong",
                purpose: "inventory_po",
                audience: "customer",
                refs: { po_id: "po-1", po_no: "PO-202610-0001" },
                workItemId: "work-1",
            })
            expect(em.query).toHaveBeenCalledWith(MARK_PO_SENT, ["po-1", "email", "Dear Huong", "work-1", null])
            expect(office.logEvidence).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ kind: "inventory.po_sent", evidence: null, workItemId: "work-1" }),
            )
            expect(result).toMatchObject({
                evidence: "captured",
                href: "/agents/inventory/workbench?tab=orders",
                detail: "Dear Huong",
            })
        })

        it("keeps a copy-ready message when the mail failed, with the reason", async () => {
            const em = mockEntityManager({ query: [MARK_PO_SENT, []] })
            const { service, mail } = await build(em)
            mail.send.mockResolvedValue({ status: "failed", error: "smtp down" })

            const result = await service.performSendPurchaseOrder(context)

            expect(em.query).toHaveBeenCalledWith(MARK_PO_SENT, ["po-1", "copy", "Dear Huong", "work-1", "smtp down"])
            expect(result.evidence).toBe("pending")
            expect(result.summary).toContain("inventory.approvedCopyResult")
        })

        it("names a default reason when the mail failed without one", async () => {
            const em = mockEntityManager({ query: [MARK_PO_SENT, []] })
            const { service, mail } = await build(em)
            mail.send.mockResolvedValue({ status: "failed" })

            await service.performSendPurchaseOrder(context)

            expect(em.query).toHaveBeenCalledWith(MARK_PO_SENT, [
                "po-1",
                "copy",
                "Dear Huong",
                "work-1",
                text("inventory.emailNotSent"),
            ])
        })

        it("keeps a copy-ready message for a supplier reached by Zalo, and for an email channel without a usable address", async () => {
            const em = mockEntityManager({
                query: [
                    [MARK_PO_SENT, []],
                    [MARK_PO_SENT, []],
                    [MARK_PO_SENT, []],
                ],
            })
            const { service, mail, orders } = await build(em)
            orders.loadPo
                .mockResolvedValueOnce(
                    poOf({
                        supplier: { name: "Mill Co", contactName: "", email: null, channel: "zalo", leadTimeDays: 2 },
                    }),
                )
                .mockResolvedValueOnce(
                    poOf({
                        supplier: {
                            name: "Mill Co",
                            contactName: "",
                            email: "nope",
                            channel: "email",
                            leadTimeDays: 2,
                        },
                    }),
                )
                .mockResolvedValueOnce(
                    poOf({
                        supplier: { name: "Mill Co", contactName: "", email: null, channel: "email", leadTimeDays: 2 },
                    }),
                )

            await service.performSendPurchaseOrder(context)
            await service.performSendPurchaseOrder(context)
            await service.performSendPurchaseOrder(context)

            expect(mail.send).not.toHaveBeenCalled()
            expect(em.query).toHaveBeenNthCalledWith(1, MARK_PO_SENT, [
                "po-1",
                "copy",
                "Dear Huong",
                "work-1",
                text("inventory.sentCopyNote", { channel: text("inventory.channelWord.zalo"), who: "Mill Co" }),
            ])
            expect(em.query).toHaveBeenNthCalledWith(2, MARK_PO_SENT, [
                "po-1",
                "copy",
                "Dear Huong",
                "work-1",
                text("inventory.supplierEmailMissing"),
            ])
        })

        it("names the fallback supplier when the order has none", async () => {
            const em = mockEntityManager({ query: [MARK_PO_SENT, []] })
            const { service, orders } = await build(em)
            orders.loadPo.mockResolvedValue(poOf({ supplier: null }))

            await service.performSendPurchaseOrder({ ...context, draft: null })

            expect(em.query).toHaveBeenCalledWith(MARK_PO_SENT, [
                "po-1",
                "copy",
                "stored message",
                "work-1",
                text("inventory.sentCopyNote", {
                    channel: text("inventory.channelWord.email"),
                    who: text("inventory.supplierFallback"),
                }),
            ])
        })

        it("sends a reminder and counts it", async () => {
            const em = mockEntityManager({ query: [MARK_PO_REMINDED, []] })
            const { service, mail, office, orders } = await build(em)
            orders.loadPo.mockResolvedValue(poOf({ status: "sent" }))
            mail.send.mockResolvedValue({ status: "sent" })

            await service.performSendPurchaseOrder({ ...context, fields: { po_id: "po-1", kind: "reminder" } })

            expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ purpose: "inventory_po_reminder" }))
            expect(em.query).toHaveBeenCalledWith(MARK_PO_REMINDED, ["po-1", null])
            expect(office.logEvidence).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ kind: "inventory.po_reminder" }),
            )
        })

        it("keeps a copy-ready reminder with a default or a given note", async () => {
            const em = mockEntityManager({
                query: [
                    [MARK_PO_REMINDED, []],
                    [MARK_PO_REMINDED, []],
                ],
            })
            const { service, mail, orders } = await build(em)
            orders.loadPo.mockResolvedValue(poOf({ status: "sent" }))
            mail.send.mockResolvedValueOnce({ status: "failed", error: "smtp down" })

            await service.performSendPurchaseOrder({ ...context, fields: { po_id: "po-1", kind: "reminder" } })
            orders.loadPo.mockResolvedValue(
                poOf({
                    status: "sent",
                    supplier: { name: "Mill Co", contactName: "", email: null, channel: "phone", leadTimeDays: 2 },
                }),
            )
            await service.performSendPurchaseOrder({ ...context, fields: { po_id: "po-1", kind: "reminder" } })

            expect(em.query).toHaveBeenNthCalledWith(1, MARK_PO_REMINDED, ["po-1", "smtp down"])
            expect(em.query).toHaveBeenNthCalledWith(2, MARK_PO_REMINDED, [
                "po-1",
                text("inventory.reminderCopyNote", { channel: text("inventory.channelWord.phone") }),
            ])
        })

        it("does not send an order twice", async () => {
            const { service, orders, mail } = await build(mockEntityManager())
            orders.loadPo.mockResolvedValue(poOf({ status: "sent" }))

            await expect(service.performSendPurchaseOrder(context)).resolves.toEqual({
                summary: text("inventory.poAlreadyHandled", { poNo: "PO-202610-0001", status: "sent" }),
                evidence: "pending",
            })

            expect(mail.send).not.toHaveBeenCalled()
        })

        it("refuses an order with no message text", async () => {
            const { service, orders } = await build(mockEntityManager())
            orders.loadPo.mockResolvedValue(poOf({ message: " " }))

            await expect(service.performSendPurchaseOrder({ ...context, draft: null })).rejects.toMatchObject({
                code: InventoryErrorCode.PoMessageEmpty,
            })
        })
    })

    describe("rejectSendPurchaseOrder", () => {
        it("puts a refused order back to a draft", async () => {
            const em = mockEntityManager({ query: [REFUSE_PO, []] })
            const { service } = await build(em)

            await service.rejectSendPurchaseOrder({
                workspaceId: "ws-1",
                workItemId: "work-1",
                actor: "Lan",
                draft: null,
                fields: { po_id: "po-1", kind: "order" },
            })

            expect(em.query).toHaveBeenCalledWith(REFUSE_PO, ["ws-1", "po-1", text("inventory.refusedNote")])
        })

        it("needs no cleanup for a refused reminder", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await service.rejectSendPurchaseOrder({
                workspaceId: "ws-1",
                workItemId: "work-1",
                actor: "Lan",
                draft: null,
                fields: { po_id: "po-1", kind: "reminder" },
            })

            expect(em.query).not.toHaveBeenCalled()
        })
    })
})
