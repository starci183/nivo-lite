import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ShiftsErrorCode } from "./errors/shifts.error"
import { APPLY_IMPORT } from "./persistence/shifts.sql"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsImportService } from "./shifts-import.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Setup } from "./shifts.contracts"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const setup: Setup = {
    positions: [
        { id: "position-1", name: "Barista", color: "#2f6fed" },
        { id: "position-2", name: "Cashier", color: "#e8590c" },
        { id: "position-3", name: "Cook", color: "#2b8a3e" },
        { id: "position-4", name: "Cleaner", color: "#ae3ec9" },
        { id: "position-5", name: "Host", color: "#0c8599" },
        { id: "position-6", name: "Runner", color: "#c2255c" },
        { id: "position-7", name: "Server", color: "#5c7cfa" },
    ],
    staff: [],
    blocks: [],
    settings: {
        openingHours: [],
        swapNoticeHours: 24,
        leaveNoticeDays: 3,
        remindMinutes: 30,
        noshowMinutes: 15,
        overtimeHoursWeek: 40,
    },
}

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Alex",
        status: "active",
    })
    const data = mock<ShiftsDataService>()
    data.loadSetup.mockResolvedValue(setup)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsImportService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsImportService), members, data, words }
}

describe("ShiftsImportService", () => {
    describe("applyImport", () => {
        it("requires manager membership before reading or changing the setup", async () => {
            const em = mockEntityManager()
            const { service, members, data, words } = await build(em)
            const denied = new Error("Membership denied")
            members.require.mockRejectedValue(denied)

            await expect(
                service.applyImport("user-1", "ws-1", { positions: "", staff: "", coverage: "" }),
            ).rejects.toBe(denied)

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(data.loadSetup).not.toHaveBeenCalled()
            expect(words.text).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses all changes when lines fail and renders the first error with the exact count and line", async () => {
            const em = mockEntityManager()
            const { service, members, data, words } = await build(em)

            await expect(
                service.applyImport("user-1", "ws-1", {
                    positions: "Baker",
                    staff: "\nAlex; Unknown; 30k\nBad",
                    coverage: "Bad coverage",
                }),
            ).rejects.toMatchObject({
                code: ShiftsErrorCode.ImportLines,
                params: {
                    count: 3,
                    line: 2,
                    reason: text("shifts.import.staff-position-unknown", { subject: "Unknown" }),
                },
            })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(words.text.mock.calls).toEqual([["shifts.import.staff-position-unknown", { subject: "Unknown" }]])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses an empty import without writing", async () => {
            const em = mockEntityManager()
            const { service, data, words } = await build(em)

            await expect(
                service.applyImport("user-1", "ws-1", { positions: " , ;\n", staff: "\n ", coverage: " " }),
            ).rejects.toMatchObject({ code: ShiftsErrorCode.ImportEmpty, params: {} })

            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(words.text).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })

        it("writes the exact parsed setup and cycles position colors after the existing positions", async () => {
            const em = mockEntityManager({ query: [APPLY_IMPORT, [{ counts: { positions: 2, staff: 2, blocks: 2 } }]] })
            const { service, members, data, words } = await build(em)

            const result = await service.applyImport("user-1", "ws-1", {
                positions: " Baker, Driver; baker ",
                staff: "Alex; barista, Baker; 30k; 40\nRobin; driver; 30.000",
                coverage: "T2-T3 7-11 baker 1-2 peak",
            })

            expect(result).toEqual({ positions: 2, staff: 2, blocks: 2 })
            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(words.text).not.toHaveBeenCalled()
            expect(em.query.mock.calls).toEqual([
                [
                    APPLY_IMPORT,
                    [
                        "ws-1",
                        JSON.stringify([
                            { name: "Baker", color: "#e67700" },
                            { name: "Driver", color: "#2f6fed" },
                        ]),
                        JSON.stringify([
                            { name: "Alex", positions: ["Barista", "Baker"], wage: 30000, maxWeek: 40 },
                            { name: "Robin", positions: ["Driver"], wage: 30000, maxWeek: null },
                        ]),
                        JSON.stringify([
                            {
                                weekday: 0,
                                start: "07:00",
                                end: "11:00",
                                position: "Baker",
                                min: 1,
                                ideal: 2,
                                peak: true,
                            },
                            {
                                weekday: 1,
                                start: "07:00",
                                end: "11:00",
                                position: "Baker",
                                min: 1,
                                ideal: 2,
                                peak: true,
                            },
                        ]),
                    ],
                ],
            ])
        })

        it("imports only people using existing position names and returns zero counts when no row is returned", async () => {
            const em = mockEntityManager({ query: [APPLY_IMPORT, []] })
            const { service } = await build(em)

            const result = await service.applyImport("user-1", "ws-1", {
                positions: "",
                staff: "Alex; BARISTA; 30k; 20",
                coverage: "",
            })

            expect(result).toEqual({ positions: 0, staff: 0, blocks: 0 })
            expect(em.query.mock.calls).toEqual([
                [
                    APPLY_IMPORT,
                    [
                        "ws-1",
                        "[]",
                        JSON.stringify([{ name: "Alex", positions: ["Barista"], wage: 30000, maxWeek: 20 }]),
                        "[]",
                    ],
                ],
            ])
        })

        it("imports only coverage using existing positions and returns zero counts when counts are null", async () => {
            const em = mockEntityManager({ query: [APPLY_IMPORT, [{ counts: null }]] })
            const { service } = await build(em)

            const result = await service.applyImport("user-1", "ws-1", {
                positions: "",
                staff: "",
                coverage: "CN 9-12 CASHIER 1",
            })

            expect(result).toEqual({ positions: 0, staff: 0, blocks: 0 })
            expect(em.query.mock.calls).toEqual([
                [
                    APPLY_IMPORT,
                    [
                        "ws-1",
                        "[]",
                        "[]",
                        JSON.stringify([
                            {
                                weekday: 6,
                                start: "09:00",
                                end: "12:00",
                                position: "Cashier",
                                min: 1,
                                ideal: 1,
                                peak: false,
                            },
                        ]),
                    ],
                ],
            ])
        })
    })
})
