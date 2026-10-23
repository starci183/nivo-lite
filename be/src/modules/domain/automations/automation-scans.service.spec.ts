import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import { AutomationScansService } from "./automation-scans.service"
import { buildPipelineRow, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import type { LoadedPipeline } from "./automations.contracts"
import {
    SELECT_DEBT_INVOICES,
    SELECT_EXPIRING_CONTRACTS,
    SELECT_LEAD_ACTIVITY,
    SELECT_LEADS_WITH_CHAT,
    SELECT_SCAN_LEADS,
} from "./persistence/automation-readers.sql"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const NOW = new Date("2026-10-12T10:00:00.000Z")
const HOUR = 3_600_000

const loaded = (key: string, config: LoadedPipeline["config"] = {}): LoadedPipeline => ({
    pipeline: buildPipelineRow({ id: "p-1", workspace_id: "ws-1", template_key: key }),
    def: buildTemplate({ key }),
    config,
})

const build = async (em: MockEntityManager) => {
    const runs = mock<AutomationRunsService>()
    runs.priorRuns.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationScansService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AutomationRunsService, useValue: runs },
        ],
    }).compile()
    return { scans: moduleRef.get(AutomationScansService), runs }
}

describe("AutomationScansService planScan", () => {
    it("plans the day report once its time has passed", async () => {
        const { scans } = await build(mockEntityManager())

        await expect(scans.planScan(loaded("daily_report", { time: "08:00" }), NOW, 8)).resolves.toEqual({
            runs: [{ dedupe: "daily:2026-10-12", triggerRef: "2026-10-12", payload: { day: "2026-10-12" } }],
            events: [],
        })
        await expect(scans.planScan(loaded("daily_report", { time: "23:00" }), NOW, 8)).resolves.toEqual({
            runs: [],
            events: [],
        })
    })

    it("plans nothing for a template with no scan", async () => {
        const { scans } = await build(mockEntityManager())

        await expect(scans.planScan(loaded("thank_payment"), NOW, 8)).resolves.toEqual({ runs: [], events: [] })
    })
})
describe("AutomationScansService lead scans", () => {
    const leadRow = (id: string) => ({ id, stage: "new", created_at: "2026-10-01T00:00:00.000Z" })
    it("nudges a quiet lead with a chat and no earlier run", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_SCAN_LEADS, [leadRow("l-1"), leadRow("l-2")]],
                [
                    SELECT_LEAD_ACTIVITY,
                    [
                        { lead_id: "l-1", last_at: new Date(NOW.getTime() - 48 * HOUR) },
                        { lead_id: "l-unlisted", last_at: "2026-10-02T00:00:00.000Z" },
                    ],
                ],
                [SELECT_LEADS_WITH_CHAT, [{ lead_id: "l-1" }]],
            ],
        })
        const { scans, runs } = await build(em)

        const plan = await scans.planScan(loaded("nurture_leads", { afterHours: 24, maxFollowUps: 2 }), NOW, 8)

        expect(plan.runs.map((run) => run.dedupe)).toEqual(["nurture:l-1:1"])
        expect(runs.priorRuns).toHaveBeenCalledWith("p-1", ["l-1", "l-2"])
        expect(em.query).toHaveBeenCalledWith(SELECT_SCAN_LEADS, [
            "ws-1",
            "2026-09-12T10:00:00.000Z",
            ["new", "qualified", "proposal"],
            null,
            200,
        ])
    })

    it("invites a lost lead back, looking at every stage but lost", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_SCAN_LEADS, [leadRow("l-1")]],
                [SELECT_LEAD_ACTIVITY, []],
                [SELECT_LEADS_WITH_CHAT, [{ lead_id: "l-1" }]],
            ],
        })
        const { scans } = await build(em)

        const plan = await scans.planScan(loaded("win_back", { afterDays: 7 }), NOW, 8)

        expect(plan.runs.map((run) => run.dedupe)).toEqual(["winback:l-1:2026-10"])
        expect(em.query).toHaveBeenCalledWith(SELECT_SCAN_LEADS, [
            "ws-1",
            "2025-10-12T10:00:00.000Z",
            null,
            "lost",
            200,
        ])
    })

    it("plans nothing when no lead is in range", async () => {
        const { scans, runs } = await build(mockEntityManager({ query: [SELECT_SCAN_LEADS, []] }))

        await expect(scans.planScan(loaded("nurture_leads"), NOW, 8)).resolves.toEqual({ runs: [], events: [] })

        expect(runs.priorRuns).not.toHaveBeenCalled()
    })
})
describe("AutomationScansService debt scan", () => {
    const invoice = (id: string, leadId: string | null, dueAt: string | null) => ({
        id,
        invoice_no: `HD-${id}`,
        amount_vnd: "250000",
        lead_id: leadId,
        due_at: dueAt,
    })
    it("reminds the customers with a chat about their overdue invoices", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_DEBT_INVOICES,
                    [
                        invoice("i-1", "l-1", "2026-09-01T00:00:00.000Z"),
                        invoice("i-2", null, null),
                        invoice("i-3", "l-3", "2026-09-02T00:00:00.000Z"),
                    ],
                ],
                [SELECT_LEADS_WITH_CHAT, [{ lead_id: "l-1" }]],
            ],
        })
        const { scans, runs } = await build(em)

        const plan = await scans.planScan(loaded("debt_reminder", { afterDays: 3 }), NOW, 8)

        expect(plan.runs).toEqual([
            expect.objectContaining({
                dedupe: "debt:i-1:1",
                payload: objectLike({ amount_vnd: 250000, invoice_no: "HD-i-1" }),
            }),
        ])
        expect(runs.priorRuns).toHaveBeenCalledWith("p-1", ["i-1", "i-2", "i-3"])
        expect(em.query).toHaveBeenCalledWith(SELECT_DEBT_INVOICES, ["ws-1", "2026-10-09T10:00:00.000Z"])
    })

    it("reads no chat when no invoice names a customer", async () => {
        const em = mockEntityManager({ query: [SELECT_DEBT_INVOICES, [invoice("i-2", null, null)]] })
        const { scans } = await build(em)

        await expect(scans.planScan(loaded("debt_reminder", { afterDays: 3 }), NOW, 8)).resolves.toEqual({
            runs: [],
            events: [],
        })
        expect(em.query).not.toHaveBeenCalledWith(SELECT_LEADS_WITH_CHAT, expect.anything())
    })
})
describe("AutomationScansService contract scan", () => {
    it("announces the contracts that end soon and were not announced for their end date", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_EXPIRING_CONTRACTS,
                    [
                        { id: "c-1", ends_on: "2026-10-20" },
                        { id: "c-2", ends_on: "2026-10-25" },
                    ],
                ],
            ],
        })
        const { scans, runs } = await build(em)
        runs.priorRuns.mockResolvedValue([
            {
                trigger_ref: "c-2",
                status: "done",
                created_at: "2026-10-01T00:00:00.000Z",
                dedupe_key: "renew:contract.expiring:c-2:2026-10-25",
            },
        ])

        const plan = await scans.planScan(loaded("contract_renewal", { beforeDays: 30 }), NOW, 8)

        expect(plan.runs).toEqual([])
        expect(plan.events.map((event) => event.dedupe)).toEqual(["contract.expiring:c-1:2026-10-20"])
        expect(em.query).toHaveBeenCalledWith(SELECT_EXPIRING_CONTRACTS, ["ws-1", "2026-10-12", "2026-11-11"])
    })

    it("plans nothing when no contract ends soon", async () => {
        const { scans, runs } = await build(mockEntityManager({ query: [SELECT_EXPIRING_CONTRACTS, []] }))

        await expect(scans.planScan(loaded("contract_renewal"), NOW, 8)).resolves.toEqual({ runs: [], events: [] })

        expect(runs.priorRuns).not.toHaveBeenCalled()
    })
})
