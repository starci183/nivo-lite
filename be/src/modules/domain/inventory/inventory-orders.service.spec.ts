import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryErrorCode } from "./errors/inventory.error"
import { InventoryOrdersService } from "./inventory-orders.service"
import {
    ADD_PO_LINES,
    CANCEL_PO,
    EDIT_PO_DRAFT,
    INSERT_PO,
    RECOMPUTE_PO_TOTAL,
    SELECT_LAST_PO_NO,
    SELECT_PO,
    SELECT_PO_LINES,
    SELECT_PO_STATUS,
    SELECT_SUPPLIER_LEAD_TIME,
} from "./persistence/inventory.sql"

const UUID = "0b8c1f0e-3a49-4b7e-9d3f-2c1f6a5d7e90"
const UUID_2 = "1c9d2a1f-4b5a-4c8f-8e4a-3d2a7b6e8fa1"

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const office = mock<OfficeLog>()
    const gate = mock<ApprovalGate>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryOrdersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: ApprovalGate, useValue: gate },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T08:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryOrdersService), office, gate, members }
}

const poRow = (overrides: Record<string, unknown> = {}) => ({
    id: "po-1",
    po_no: "PO-202610-0001",
    supplier_id: UUID,
    status: "draft",
    total_vnd: "60000",
    expected_at: "2026-10-14",
    message: "",
    reminders: 0,
    supplier_name: "Mill Co",
    supplier_contact: "Huong",
    supplier_email: "a@b.vn",
    supplier_channel: "zalo",
    supplier_lead_time: 3,
    ...overrides,
})

describe("InventoryOrdersService", () => {
    describe("loadPo", () => {
        it("loads the order with its supplier and lines", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_PO, [poRow()]],
                    [
                        SELECT_PO_LINES,
                        [
                            {
                                id: "line-1",
                                item_id: "item-1",
                                qty_ordered: "10.000",
                                qty_received: "2.500",
                                unit_cost_vnd: "6000.00",
                                item_name: "Tea",
                                item_unit: "kg",
                            },
                        ],
                    ],
                ],
            })
            const { service } = await build(em)

            await expect(service.loadPo("ws-1", "po-1")).resolves.toEqual({
                id: "po-1",
                poNo: "PO-202610-0001",
                supplierId: UUID,
                status: "draft",
                totalVnd: 60000,
                expectedAt: "2026-10-14",
                message: "",
                reminders: 0,
                supplier: { name: "Mill Co", contactName: "Huong", email: "a@b.vn", channel: "zalo", leadTimeDays: 3 },
                lines: [
                    {
                        id: "line-1",
                        itemId: "item-1",
                        qtyOrdered: 10,
                        qtyReceived: 2.5,
                        unitCost: 6000,
                        itemName: "Tea",
                        itemUnit: "kg",
                    },
                ],
            })
        })

        it("reads a supplier without contact, lead time or a known channel with the defaults, and an order without a supplier as none", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        SELECT_PO,
                        [poRow({ supplier_contact: null, supplier_channel: "phone", supplier_lead_time: null })],
                    ],
                    [SELECT_PO_LINES, []],
                    [SELECT_PO, [poRow({ supplier_channel: "fax" })]],
                    [SELECT_PO_LINES, []],
                    [SELECT_PO, [poRow({ supplier_name: null, supplier_id: null })]],
                    [SELECT_PO_LINES, []],
                ],
            })
            const { service } = await build(em)

            await expect(service.loadPo("ws-1", "po-1")).resolves.toMatchObject({
                supplier: { contactName: "", channel: "phone", leadTimeDays: 2 },
            })
            await expect(service.loadPo("ws-1", "po-1")).resolves.toMatchObject({ supplier: { channel: "email" } })
            await expect(service.loadPo("ws-1", "po-1")).resolves.toMatchObject({ supplier: null })
        })

        it("refuses an order the workspace does not have", async () => {
            const em = mockEntityManager({ query: [SELECT_PO, []] })
            const { service } = await build(em)

            await expect(service.loadPo("ws-1", "po-9")).rejects.toMatchObject({ code: InventoryErrorCode.PoNotFound })
        })
    })

    describe("leadTimeOf", () => {
        it("reads the delivery time of a supplier or the default", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_SUPPLIER_LEAD_TIME, [{ lead_time_days: 5 }]],
                    [SELECT_SUPPLIER_LEAD_TIME, []],
                ],
            })
            const { service } = await build(em)

            await expect(service.leadTimeOf("ws-1", UUID)).resolves.toBe(5)
            await expect(service.leadTimeOf("ws-1", UUID)).resolves.toBe(2)
        })
    })

    describe("createPoRecord", () => {
        const input = {
            supplierId: UUID,
            lines: [{ itemId: "item-1", qty: 4, unitCost: 100 }],
            by: "Lan",
            source: "manual" as const,
            leadTimeDays: 3,
        }

        it("writes the order, its lines and its total in one transaction, dated from the lead time", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_LAST_PO_NO, [{ po_no: "PO-202610-0007" }]],
                        [INSERT_PO, [{ id: "po-1" }]],
                        [ADD_PO_LINES, []],
                        [RECOMPUTE_PO_TOTAL, [{ total: "400" }]],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await expect(service.createPoRecord("ws-1", input)).resolves.toBe("po-1")

            expect(tx.em.query).toHaveBeenCalledWith(SELECT_LAST_PO_NO, ["ws-1", "PO-202610-%"])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_PO, [
                "ws-1",
                "PO-202610-0008",
                UUID,
                "2026-10-15",
                "",
                "manual",
                "Lan",
            ])
            expect(tx.em.query).toHaveBeenCalledWith(ADD_PO_LINES, ["ws-1", "po-1", ["item-1"], [4], [100]])
            expect(tx.commits).toBe(1)
        })

        it("retries with the next number when the first is taken and keeps a typed expected day", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_LAST_PO_NO, []],
                        [INSERT_PO, [{ id: null }]],
                        [SELECT_LAST_PO_NO, [{ po_no: "PO-202610-0001" }]],
                        [INSERT_PO, [{ id: "po-2" }]],
                        [ADD_PO_LINES, []],
                        [RECOMPUTE_PO_TOTAL, [{ total: "400" }]],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await expect(service.createPoRecord("ws-1", { ...input, expectedAt: "2026-11-01" })).resolves.toBe("po-2")

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_PO, [
                "ws-1",
                "PO-202610-0001",
                UUID,
                "2026-11-01",
                "",
                "manual",
                "Lan",
            ])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_PO, [
                "ws-1",
                "PO-202610-0002",
                UUID,
                "2026-11-01",
                "",
                "manual",
                "Lan",
            ])
        })

        it("gives up after four numbers were taken", async () => {
            const taken = [SELECT_LAST_PO_NO, []] as const
            const refused = [INSERT_PO, []] as const
            const tx = fakeTransaction(
                mockEntityManager({ query: [taken, refused, taken, refused, taken, refused, taken, refused] }),
            )
            const { service } = await build(tx.em)

            await expect(service.createPoRecord("ws-1", input)).rejects.toMatchObject({
                code: InventoryErrorCode.PoNumberUnavailable,
            })
            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("addLines", () => {
        it("adds the lines and refreshes the total in one transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [ADD_PO_LINES, []],
                        [RECOMPUTE_PO_TOTAL, [{ total: "1" }]],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await service.addLines("ws-1", "po-1", [{ itemId: "item-1", qty: 2, unitCost: 5 }])

            expect(tx.em.query).toHaveBeenCalledWith(ADD_PO_LINES, ["ws-1", "po-1", ["item-1"], [2], [5]])
            expect(tx.em.query).toHaveBeenCalledWith(RECOMPUTE_PO_TOTAL, ["po-1"])
        })
    })

    describe("createPo", () => {
        const lines = [
            { itemId: UUID_2, qty: "4,5", unitCost: "1.200" },
            { itemId: "bad", qty: "1", unitCost: "1" },
            { itemId: UUID, qty: "0", unitCost: "1" },
        ]

        it("creates an order from the usable lines with the supplier lead time", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_SUPPLIER_LEAD_TIME, [{ lead_time_days: 1 }]],
                        [SELECT_LAST_PO_NO, []],
                        [INSERT_PO, [{ id: "po-1" }]],
                        [ADD_PO_LINES, []],
                        [RECOMPUTE_PO_TOTAL, [{ total: "1" }]],
                    ],
                }),
            )
            const { service, members } = await build(tx.em)

            await expect(
                service.createPo("user-1", "ws-1", { supplierId: UUID, expectedAt: "bad", lines }),
            ).resolves.toEqual({ id: "po-1" })

            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_PO, [
                "ws-1",
                "PO-202610-0001",
                UUID,
                "2026-10-13",
                "",
                "manual",
                "Lan",
            ])
            expect(tx.em.query).toHaveBeenCalledWith(ADD_PO_LINES, ["ws-1", "po-1", [UUID_2], [4.5], [1200]])
        })

        it("creates an order without a supplier, dated from the default delivery time or a typed day", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_LAST_PO_NO, []],
                        [INSERT_PO, [{ id: "po-1" }]],
                        [ADD_PO_LINES, []],
                        [RECOMPUTE_PO_TOTAL, [{ total: "1" }]],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await service.createPo("user-1", "ws-1", { supplierId: "", expectedAt: "2026-12-01", lines })

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_PO, [
                "ws-1",
                "PO-202610-0001",
                null,
                "2026-12-01",
                "",
                "manual",
                "Lan",
            ])
        })

        it("refuses an order with no usable line", async () => {
            const { service } = await build(mockEntityManager())

            await expect(
                service.createPo("user-1", "ws-1", { supplierId: "", expectedAt: "", lines: [] }),
            ).rejects.toMatchObject({ code: InventoryErrorCode.PoLinesRequired })
        })
    })

    describe("updatePoDraft", () => {
        const request = {
            poId: "po-1",
            supplierId: UUID,
            expectedAt: "2026-10-20",
            lines: [
                { lineId: "line-1", qty: "2", unitCost: "5" },
                { lineId: "line-2", qty: "0", unitCost: "" },
            ],
        }

        it("edits a draft in one database step", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_PO_STATUS, [{ id: "po-1", status: "draft" }]],
                    [EDIT_PO_DRAFT, []],
                ],
            })
            const { service } = await build(em)

            await service.updatePoDraft("user-1", "ws-1", request)

            expect(em.query).toHaveBeenCalledWith(EDIT_PO_DRAFT, [
                "po-1",
                UUID,
                "2026-10-20",
                ["line-1", "line-2"],
                [2, 0],
                [5, 0],
            ])
        })

        it("clears an unusable supplier and day", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_PO_STATUS, [{ id: "po-1", status: "draft" }]],
                    [EDIT_PO_DRAFT, []],
                ],
            })
            const { service } = await build(em)

            await service.updatePoDraft("user-1", "ws-1", { ...request, supplierId: "", expectedAt: "soon" })

            expect(em.query).toHaveBeenCalledWith(EDIT_PO_DRAFT, [
                "po-1",
                null,
                null,
                ["line-1", "line-2"],
                [2, 0],
                [5, 0],
            ])
        })

        it("refuses an unknown order and an order that is no longer a draft", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_PO_STATUS, []],
                    [SELECT_PO_STATUS, [{ id: "po-1", status: "sent" }]],
                ],
            })
            const { service } = await build(em)

            await expect(service.updatePoDraft("user-1", "ws-1", request)).rejects.toMatchObject({
                code: InventoryErrorCode.PoNotFound,
            })
            await expect(service.updatePoDraft("user-1", "ws-1", request)).rejects.toMatchObject({
                code: InventoryErrorCode.PoNotDraft,
            })
        })
    })

    describe("cancelPo", () => {
        it("cancels the order, closes the waiting decision and logs it", async () => {
            const em = mockEntityManager({ query: [CANCEL_PO, [{ po_no: "PO-202610-0001", work_item_id: "work-1" }]] })
            const { service, gate, office } = await build(em)

            await service.cancelPo("user-1", "ws-1", { poId: "po-1" })

            expect(gate.decide).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                workItemId: "work-1",
                decision: "rejected",
                decidedBy: "Lan",
            })
            expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
                kind: "inventory.po_cancelled",
                actor: "Lan",
                summary: 'inventory.poCancelledSummary{"poNo":"PO-202610-0001"}',
            })
        })

        it("leaves the gate alone when no decision waits", async () => {
            const em = mockEntityManager({ query: [CANCEL_PO, [{ po_no: "PO-202610-0001", work_item_id: null }]] })
            const { service, gate } = await build(em)

            await service.cancelPo("user-1", "ws-1", { poId: "po-1" })

            expect(gate.decide).not.toHaveBeenCalled()
        })

        it("refuses an order that can no longer be cancelled", async () => {
            const em = mockEntityManager({ query: [CANCEL_PO, []] })
            const { service } = await build(em)

            await expect(service.cancelPo("user-1", "ws-1", { poId: "po-1" })).rejects.toMatchObject({
                code: InventoryErrorCode.PoNotCancellable,
            })
        })
    })
})
