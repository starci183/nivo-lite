import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import { AutomationScansService } from "./automation-scans.service"
import { buildPipelineRow, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import type { LoadedPipeline } from "./automations.contracts"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder, QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"

const READS = new WeakMap<object, ReadonlyArray<FakeQueryBuilder>>()

/** The manager of {@link readingOf}. */
interface ReadingManager {
    /** The manager whose reads answer the given results. */
    readonly em: MockEntityManager
}

/** A manager whose reads (and the snapshot transaction around some of them) answer `answers`, one fake statement each, in order. */
const readingOf = (...answers: Array<QueryBuilderAnswers>): ReadingManager => {
    const em = mockEntityManager()
    fakeTransaction(em)
    READS.set(em, queueQueryBuilders(em, answers))
    return { em }
}

/** The fake statements of a manager made by {@link readingOf}, in the order the subject built them. */
const readsOf = (em: object): ReadonlyArray<FakeQueryBuilder> => READS.get(em) ?? []

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
        const em = readingOf(
            { getRawMany: [leadRow("l-1"), leadRow("l-2")] },
            {
                getRawMany: [
                    { lead_id: "l-1", last_at: new Date(NOW.getTime() - 48 * HOUR) },
                    { lead_id: "l-unlisted", last_at: "2026-10-02T00:00:00.000Z" },
                ],
            },
            { getRawMany: [{ lead_id: "l-1" }] },
        ).em
        const { scans, runs } = await build(em)

        const plan = await scans.planScan(loaded("nurture_leads", { afterHours: 24, maxFollowUps: 2 }), NOW, 8)

        expect(plan.runs.map((run) => run.dedupe)).toEqual(["nurture:l-1:1"])
        expect(runs.priorRuns).toHaveBeenCalledWith("p-1", ["l-1", "l-2"])
        const [leads] = readsOf(em)
        expect(leads?.callsOf("where")).toEqual([
            [
                expect.stringContaining(".created_at >= :since"),
                { workspaceId: "ws-1", since: "2026-09-12T10:00:00.000Z" },
            ],
        ])
        expect(leads?.callsOf("andWhere")).toEqual([
            [expect.stringContaining("l.stage = ANY(:stages)"), { stages: ["new", "qualified", "proposal"] }],
        ])
        expect(leads?.callsOf("limit")).toEqual([[200]])
    })

    it("invites a lost lead back, looking at every stage but lost", async () => {
        const em = readingOf(
            { getRawMany: [leadRow("l-1")] },
            { getRawMany: [] },
            { getRawMany: [{ lead_id: "l-1" }] },
        ).em
        const { scans } = await build(em)

        const plan = await scans.planScan(loaded("win_back", { afterDays: 7 }), NOW, 8)

        expect(plan.runs.map((run) => run.dedupe)).toEqual(["winback:l-1:2026-10"])
        const [leads] = readsOf(em)
        expect(leads?.callsOf("where")).toEqual([
            [
                expect.stringContaining(".created_at >= :since"),
                { workspaceId: "ws-1", since: "2025-10-12T10:00:00.000Z" },
            ],
        ])
        expect(leads?.callsOf("andWhere")).toEqual([
            [expect.stringContaining("l.stage <> :except"), { except: "lost" }],
        ])
    })

    it("plans nothing when no lead is in range", async () => {
        const { scans, runs } = await build(readingOf({ getRawMany: [] }).em)

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
        const em = readingOf(
            {
                getRawMany: [
                    invoice("i-1", "l-1", "2026-09-01T00:00:00.000Z"),
                    invoice("i-2", null, null),
                    invoice("i-3", "l-3", "2026-09-02T00:00:00.000Z"),
                ],
            },
            { getRawMany: [{ lead_id: "l-1" }] },
        ).em
        const { scans, runs } = await build(em)

        const plan = await scans.planScan(loaded("debt_reminder", { afterDays: 3 }), NOW, 8)

        expect(plan.runs).toEqual([
            expect.objectContaining({
                dedupe: "debt:i-1:1",
                payload: objectLike({ amount_vnd: 250000, invoice_no: "HD-i-1" }),
            }),
        ])
        expect(runs.priorRuns).toHaveBeenCalledWith("p-1", ["i-1", "i-2", "i-3"])
        expect(readsOf(em)[0]?.callsOf("where")).toEqual([
            [
                expect.stringContaining("i.due_at < :cutoff"),
                { workspaceId: "ws-1", cutoff: "2026-10-09T10:00:00.000Z" },
            ],
        ])
    })

    it("reads no chat when no invoice names a customer", async () => {
        const em = readingOf({ getRawMany: [invoice("i-2", null, null)] }).em
        const { scans } = await build(em)

        await expect(scans.planScan(loaded("debt_reminder", { afterDays: 3 }), NOW, 8)).resolves.toEqual({
            runs: [],
            events: [],
        })
        expect(readsOf(em)).toHaveLength(1)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
})
describe("AutomationScansService contract scan", () => {
    it("announces the contracts that end soon and were not announced for their end date", async () => {
        const em = readingOf({
            getRawMany: [
                { id: "c-1", ends_on: "2026-10-20" },
                { id: "c-2", ends_on: "2026-10-25" },
            ],
        }).em
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
        expect(readsOf(em)[0]?.callsOf("where")).toEqual([
            [
                expect.stringContaining("c.ends_on >= :firstDay"),
                { workspaceId: "ws-1", firstDay: "2026-10-12", lastDay: "2026-11-11" },
            ],
        ])
    })

    it("plans nothing when no contract ends soon", async () => {
        const { scans, runs } = await build(readingOf({ getRawMany: [] }).em)

        await expect(scans.planScan(loaded("contract_renewal"), NOW, 8)).resolves.toEqual({ runs: [], events: [] })

        expect(runs.priorRuns).not.toHaveBeenCalled()
    })
})
