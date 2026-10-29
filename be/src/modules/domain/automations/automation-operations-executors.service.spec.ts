import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MockEntityManager } from "@starci/jest-preset"
import { DeskDailyService, renewalSectionOf } from "@modules/domain/accounting"
import type { RenewalCashReport } from "@modules/domain/accounting"
import type { RunResult } from "@modules/domain/automation-runs"
import { AutomationMessagesService } from "./automation-messages.service"
import { AutomationRenewalPaymentService } from "./automation-renewal-payment.service"
import { AUTOMATION_OFFICE, AUTOMATION_OWNER_CHAT, AUTOMATION_RECORDS } from "./automations.decorators"
import { AutomationOperationsExecutorsService } from "./automation-operations-executors.service"
import type {
    AutomationOffice,
    AutomationOwnerChat,
    AutomationRecords,
    ExecutorContext,
    ExecutorMap,
    ExecutorPayload,
} from "./automation-ports.contracts"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import type { DayFigures } from "./automation-reads.contracts"
import type { LeadRead } from "./automation-reads.contracts"
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

/** What the five statements of the day report answer for these figures, in the order they run. */
const dayFiguresAnswers = (figures: DayFigures | undefined): Array<QueryBuilderAnswers> => [
    { getRawOne: figures && { count: figures.new_leads } },
    { getRawOne: figures && { count: figures.confirmed_orders, total: figures.confirmed_total } },
    { getRawOne: figures && { total: figures.money_in } },
    { getRawOne: figures && { count: figures.won_leads } },
    { getRawMany: (figures?.waiting ?? []).map((summary) => ({ summary })) },
]

const RENEWAL_REPORT = mock<RenewalCashReport>({ lines: ["   - Renewal line"] })
const textLike = (text: string): unknown => expect.stringContaining(text)

const NOW = "2026-10-12T10:00:00.000Z"
const LEAD: LeadRead = {
    id: "l-1",
    contact_name: "An",
    company: "",
    channel: "web",
    need: "hoa",
    stage: "new",
    phone: "0900",
    email: null,
}
const SENT: RunResult = { status: "waiting_approval", steps: [{ label: "sent", status: "waiting" }], evidence: "wait" }
const CONVERSATION = { id: "cv-1", channel: "web", handled_by: null, visitor_name: null, lead_id: "l-1" }
const CONTRACT = {
    id: "c-1",
    customer_name: "Binh",
    lead_id: "l-1",
    plan: "Gold",
    ends_on: "2026-10-20",
    amount_vnd: null,
    status: "active",
}

const context = (config: ExecutorContext["config"] = {}): ExecutorContext => ({
    workspaceId: "ws-1",
    pipeline: buildPipelineRow(),
    def: buildTemplate(),
    config,
    body: "Hi",
    shop: buildShop({ shop: "Tiem Hoa" }),
})

const runner =
    (executors: ExecutorMap) =>
    (key: string, ctx: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> =>
        executors[key]?.(ctx, payload) ?? Promise.reject(new TypeError(`no executor for ${key}`))

const build = async (em: MockEntityManager = mockEntityManager(), useNullChat = false) => {
    const office = mock<AutomationOffice>()
    office.openFollowUp.mockResolvedValue(true)
    const records = mock<AutomationRecords>()
    records.createLead.mockResolvedValue("l-new")
    const chat = mock<AutomationOwnerChat>()
    chat.sendToOwner.mockResolvedValue(!useNullChat)
    const messages = mock<AutomationMessagesService>()
    messages.say.mockImplementation((key, params) => `${key}${JSON.stringify(params ?? {})}`)
    messages.actorOf.mockReturnValue("actor")
    messages.skipped.mockImplementation((detail) => ({
        status: "skipped",
        steps: [{ label: "skip", status: "skipped", detail }],
    }))
    messages.leadOf.mockResolvedValue(LEAD)
    messages.lead.mockResolvedValue(LEAD)
    messages.conversationOf.mockResolvedValue(CONVERSATION)
    messages.composeAndSend.mockResolvedValue(SENT)
    messages.firstStaffName.mockResolvedValue("Lan")
    const renewal = mock<AutomationRenewalPaymentService>()
    renewal.paymentOf.mockResolvedValue(null)
    renewal.zaloWindowSteps.mockResolvedValue([])
    const desk = mock<DeskDailyService>()
    desk.renewalOfDay.mockResolvedValue(RENEWAL_REPORT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationOperationsExecutorsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AUTOMATION_OFFICE, useValue: office },
            { provide: AUTOMATION_RECORDS, useValue: records },
            { provide: AUTOMATION_OWNER_CHAT, useValue: chat },
            { provide: AutomationMessagesService, useValue: messages },
            { provide: AutomationRenewalPaymentService, useValue: renewal },
            { provide: DeskDailyService, useValue: desk },
        ],
    }).compile()
    const service = moduleRef.get(AutomationOperationsExecutorsService)
    return { office, records, chat, messages, renewal, desk, run: runner(service.executors()) }
}

describe("AutomationOperationsExecutorsService daily_report", () => {
    const figures = {
        new_leads: 3,
        confirmed_orders: 2,
        confirmed_total: "900000",
        money_in: "500000",
        won_leads: 4,
        waiting: ["a".repeat(120), null, "c", "d"],
    }
    it("posts the day to Office with the deals, the money and what waits", async () => {
        const em = readingOf(...dayFiguresAnswers(figures)).em
        const { run, office, desk } = await build(em)

        const result = await run("daily_report", context(), { day: "2026-10-11" })

        expect(readsOf(em)[0]?.callsOf("where")).toEqual([
            [
                expect.stringContaining(".created_at >= :start"),
                { workspaceId: "ws-1", start: "2026-10-10T17:00:00.000Z" },
            ],
        ])
        const text = (office.postLine.mock.calls[0] ?? [])[1] ?? ""
        expect(text.split("\n")).toEqual([
            'report.title{"day":"11/10/2026","shop":"Tiem Hoa"}',
            'report.newLeads{"count":3}',
            expect.stringContaining("report.dealsTotal"),
            expect.stringContaining("report.moneyIn"),
            'report.waitingSome{"count":4}',
            `   - ${"a".repeat(90)}`,
            "   - ",
            "   - c",
            ...renewalSectionOf(RENEWAL_REPORT).split("\n"),
        ])
        expect(desk.renewalOfDay).toHaveBeenCalledWith("ws-1", "2026-10-11")
        expect(result).toMatchObject({
            status: "done",
            steps: [{ label: "report.posted{}", status: "done", message: text }],
            evidence: textLike('"deals":4'),
        })
    })

    it("reports an empty day: today, no deals, nothing waiting", async () => {
        const em = readingOf(...dayFiguresAnswers(undefined)).em
        const { run, office } = await build(em)

        const result = await run("daily_report", context(), {})

        expect(readsOf(em)[0]?.callsOf("where")).toEqual([
            [
                expect.stringContaining(".created_at >= :start"),
                { workspaceId: "ws-1", start: "2026-10-11T17:00:00.000Z" },
            ],
        ])
        const text = (office.postLine.mock.calls[0] ?? [])[1] ?? ""
        expect(text).toContain('report.deals{"count":0}')
        expect(text).toContain("report.waitingNone{}")
        expect(result.steps).toHaveLength(1)
    })

    it("also sends the report to the chat of the owner when asked", async () => {
        const em = readingOf(...dayFiguresAnswers(figures)).em
        const { run, chat } = await build(em)

        const result = await run("daily_report", context({ toOwnerChat: true }), {})

        expect(chat.sendToOwner).toHaveBeenCalledWith("ws-1", expect.stringContaining("report.title"))
        expect(result.steps[1]).toEqual({ label: "report.chatSent{}", status: "done" })
    })

    it("says the chat was skipped when it cannot be reached", async () => {
        const em = readingOf(...dayFiguresAnswers(figures)).em
        const unreachable = await build(em)
        unreachable.chat.sendToOwner.mockResolvedValue(false)

        const result = await unreachable.run("daily_report", context({ toOwnerChat: true }), {})

        expect(result.steps[1]).toEqual({
            label: "report.chatSkipped{}",
            status: "skipped",
            detail: "report.chatSkippedDetail{}",
        })
    })
})
describe("AutomationOperationsExecutorsService daily_report", () => {
    const figures = {
        new_leads: 3,
        confirmed_orders: 2,
        confirmed_total: "900000",
        money_in: "500000",
        won_leads: 4,
        waiting: ["a".repeat(120), null, "c", "d"],
    }
    it("keeps the report in Office when the null chat adapter is registered", async () => {
        const em = readingOf(...dayFiguresAnswers(figures)).em
        const { run, office } = await build(em, true)

        const result = await run("daily_report", context({ toOwnerChat: true }), {})

        expect(office.postLine).toHaveBeenCalledWith("ws-1", expect.stringContaining("report.title"), null)
        expect(result.steps[1]).toEqual({
            label: "report.chatSkipped{}",
            status: "skipped",
            detail: "report.chatSkippedDetail{}",
        })
    })
})
describe("AutomationOperationsExecutorsService delivery_notice", () => {
    const order = {
        id: "o-1",
        order_no: "DH1",
        lead_id: "l-1",
        shipped_at: "2026-10-11T00:00:00.000Z",
        carrier: " GHN ",
        tracking_code: " ABC ",
    }
    it("tells the customer the order left, with the carrier and the tracking code", async () => {
        const em = readingOf({ getRawOne: order }).em
        const { run, messages } = await build(em)

        await expect(run("delivery_notice", context(), { order_id: "o-1" })).resolves.toBe(SENT)

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                dedupe: "ship:o-1",
                caseNote: textLike("delivery.caseTracking"),
                vars: { ten_khach: "An", ma_phieu: "DH1", hang_van_chuyen: "GHN", ma_van_don: "ABC" },
            }),
        )
    })

    it("falls back on standard words when the order has no carrier or tracking code", async () => {
        const em = readingOf({ getRawOne: { ...order, carrier: null, tracking_code: null } }).em
        const { run, messages } = await build(em)

        await run("delivery_notice", context(), { order_id: "o-1" })

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                summary: textLike("delivery.carrierFallback"),
                caseNote: textLike("delivery.case{"),
            }),
        )
    })

    it("skips an order that is not shipped, has no customer or no chat", async () => {
        const missing = await build(readingOf({ getRawOne: undefined }).em)
        const unshipped = await build(readingOf({ getRawOne: { ...order, shipped_at: null } }).em)
        const noLead = await build(readingOf({ getRawOne: { ...order, lead_id: null } }).em)
        noLead.messages.leadOf.mockResolvedValue(null)
        const noChat = await build(readingOf({ getRawOne: order }).em)
        noChat.messages.conversationOf.mockResolvedValue(null)

        await missing.run("delivery_notice", context(), {})
        await unshipped.run("delivery_notice", context(), { order_id: "o-1" })
        await noLead.run("delivery_notice", context(), { order_id: "o-1" })
        await noChat.run("delivery_notice", context(), { order_id: "o-1" })

        expect(missing.messages.skipped).toHaveBeenCalledWith("delivery.notShipped{}")
        expect(unshipped.messages.skipped).toHaveBeenCalledWith("delivery.notShipped{}")
        expect(noLead.messages.skipped).toHaveBeenCalledWith('delivery.noLead{"order":"DH1"}')
        expect(noLead.messages.leadOf).toHaveBeenCalledWith("ws-1", "")
        expect(noChat.messages.skipped).toHaveBeenCalledWith('delivery.noChat{"name":"An"}')
    })
})
describe("AutomationOperationsExecutorsService contract_renewal", () => {
    it("drafts the renewal message, asks the owner and opens a follow-up for sales", async () => {
        const { run, messages, office } = await build(readingOf({ getRawOne: CONTRACT }).em)

        const result = await run("contract_renewal", context(), { contract_id: "c-1", ends_on: "2026-10-20" })

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                action: "send_follow_up",
                dedupe: "renew:c-1:2026-10-20",
                forceAsk: true,
                vars: { ten_khach: "An", ten_goi: "Gold", ngay_het_han: "20/10/2026" },
            }),
        )
        expect(office.openFollowUp).toHaveBeenCalledWith("ws-1", {
            leadId: "l-1",
            title: 'renewal.taskTitle{"plan":"Gold","name":"An","ends":"20/10/2026"}',
            ownerName: "Lan",
            nextAction: 'renewal.taskActionPhone{"name":"An","phone":"0900","plan":"Gold","ends":"20/10/2026"}',
            dueAt: "2026-10-14T10:00:00.000Z",
        })
        expect(office.postLine).toHaveBeenCalledTimes(1)
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            leadId: "l-1",
            kind: "automation.contract_renewal",
            actor: "actor",
            summary: 'renewal.evidenceSummary{"plan":"Gold","name":"An"}',
            evidence: "c-1:2026-10-20",
        })
        expect(result).toEqual({
            status: "waiting_approval",
            steps: [
                { label: "sent", status: "waiting" },
                {
                    label: "renewal.taskStep{}",
                    status: "done",
                    detail: 'renewal.taskDetail{"staff":"Lan","ends":"20/10/2026"}',
                },
            ],
            evidence: "wait",
        })
    })

    it("lets the owner switch the question off, and follows up on the end date when it is sooner", async () => {
        const { run, messages, office } = await build(
            readingOf({ getRawOne: { ...CONTRACT, ends_on: "2026-10-13", plan: "  " } }).em,
        )

        await run("contract_renewal", context({ alwaysAsk: false }), { contract_id: "c-1" })

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ forceAsk: false }),
        )
        expect(office.openFollowUp).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ dueAt: "2026-10-12T17:00:00.000Z" }),
        )
    })
})
describe("AutomationOperationsExecutorsService contract_renewal", () => {
    it("only notes a follow-up that was already open, and uses the standard staff name and the action without a phone", async () => {
        const { run, messages, office } = await build(readingOf({ getRawOne: CONTRACT }).em)
        office.openFollowUp.mockResolvedValue(false)
        messages.firstStaffName.mockResolvedValue(null)
        messages.lead.mockResolvedValue({ ...LEAD, phone: null })

        const result = await run("contract_renewal", context(), { contract_id: "c-1" })

        expect(office.postLine).not.toHaveBeenCalled()
        expect(office.openFollowUp).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                ownerName: "after.staffFallback{}",
                nextAction: textLike("renewal.taskAction{"),
            }),
        )
        expect(result.steps).toHaveLength(1)
    })

    it("does not message a customer without a chat but still opens the follow-up", async () => {
        const { run, messages } = await build(readingOf({ getRawOne: CONTRACT }).em)
        messages.conversationOf.mockResolvedValue(null)

        const result = await run("contract_renewal", context(), { contract_id: "c-1" })

        expect(messages.composeAndSend).not.toHaveBeenCalled()
        expect(result).toMatchObject({
            status: "done",
            evidence: null,
            steps: [{ label: "renewal.notMessaged{}", status: "skipped" }, { label: "renewal.taskStep{}" }],
        })
    })

    it("makes a lead for a contract typed in by name and attaches it", async () => {
        const { run, records, messages } = await build(
            readingOf({ getRawOne: { ...CONTRACT, lead_id: null } }, { getRawOne: { ...CONTRACT, lead_id: null } }).em,
        )

        await run("contract_renewal", context(), { contract_id: "c-1" })

        expect(records.createLead).toHaveBeenCalledWith("ws-1", {
            contactName: "Binh",
            channel: "renewal.channel{}",
            need: 'renewal.need{"plan":"Gold"}',
            stage: "qualified",
        })
        expect(records.attachContractLead).toHaveBeenCalledWith("ws-1", "c-1", "l-new")
        expect(messages.lead).toHaveBeenCalledWith("ws-1", "l-new")
    })

    it("skips a contract that is gone, no longer active, moved to another end date or has no lead", async () => {
        const gone = await build(readingOf({ getRawOne: undefined }).em)
        const noId = await build(mockEntityManager())
        const ended = await build(readingOf({ getRawOne: { ...CONTRACT, status: "ended" } }).em)
        const moved = await build(readingOf({ getRawOne: CONTRACT }).em)
        const noLead = await build(readingOf({ getRawOne: CONTRACT }).em)
        noLead.messages.lead.mockResolvedValue(null)

        await gone.run("contract_renewal", context(), { contract_id: "c-1" })
        await noId.run("contract_renewal", context(), {})
        await ended.run("contract_renewal", context(), { contract_id: "c-1" })
        await moved.run("contract_renewal", context(), { contract_id: "c-1", ends_on: "2026-11-01" })
        await noLead.run("contract_renewal", context(), { contract_id: "c-1" })

        expect(gone.messages.skipped).toHaveBeenCalledWith("renewal.gone{}")
        expect(noId.messages.skipped).toHaveBeenCalledWith("renewal.gone{}")
        expect(ended.messages.skipped).toHaveBeenCalledWith("renewal.gone{}")
        expect(moved.messages.skipped).toHaveBeenCalledWith("renewal.moved{}")
        expect(noLead.messages.skipped).toHaveBeenCalledWith("renewal.noLead{}")
    })
})
describe("AutomationOperationsExecutorsService contract_renewal links the customer", () => {
    it("links the contracts to their customers before it makes a lead, and uses the lead the link found", async () => {
        const unlinked = { ...CONTRACT, lead_id: null }
        const { run, records } = await build(readingOf({ getRawOne: unlinked }, { getRawOne: unlinked }).em)
        records.linkCustomers.mockResolvedValue(undefined)
        await run("contract_renewal", context(), { contract_id: "c-1" })
        expect(records.linkCustomers).toHaveBeenCalledWith("ws-1")
        expect(records.linkCustomers.mock.invocationCallOrder[0]).toBeLessThan(
            records.createLead.mock.invocationCallOrder[0] ?? 0,
        )
        const linked = await build(
            readingOf({ getRawOne: unlinked }, { getRawOne: { ...unlinked, lead_id: "l-1" } }).em,
        )
        await linked.run("contract_renewal", context(), { contract_id: "c-1" })
        expect(linked.records.linkCustomers).toHaveBeenCalledWith("ws-1")
        expect(linked.records.createLead).not.toHaveBeenCalled()
        expect(linked.messages.lead).toHaveBeenCalledWith("ws-1", "l-1")
    })

    it("keeps the contract it read when it cannot be read again after the link", async () => {
        const unlinked = { ...CONTRACT, lead_id: null }
        const { run, records } = await build(readingOf({ getRawOne: unlinked }, { getRawOne: undefined }).em)
        records.linkCustomers.mockResolvedValue(undefined)

        await run("contract_renewal", context(), { contract_id: "c-1" })

        expect(records.linkCustomers).toHaveBeenCalledWith("ws-1")
        expect(records.createLead).toHaveBeenCalledTimes(1)
    })

    it("does not link when the contract already has its lead", async () => {
        const { run, records } = await build(readingOf({ getRawOne: CONTRACT }).em)
        await run("contract_renewal", context(), { contract_id: "c-1" })
        expect(records.linkCustomers).not.toHaveBeenCalled()
    })
})
describe("AutomationOperationsExecutorsService contract_renewal with a payment", () => {
    const PAYMENT = {
        vars: { so_hoa_don: "INV-202611-0003", so_tien: "1.620.000d", noi_dung_ck: "INV2026110003", link_qr: "qr" },
        fixedTail: "Hoa don: INV-202611-0003\nQR: qr",
        keepExact: undefined,
        steps: [{ label: "invoice", status: "done" as const }],
        invoiceNo: "INV-202611-0003",
        amountVnd: 1620000,
        transferContent: "INV2026110003",
    }

    it("sends the payment lines as a fixed tail, reports the invoice first and names it in the evidence", async () => {
        const { run, messages, renewal, office } = await build(readingOf({ getRawOne: CONTRACT }).em)
        renewal.paymentOf.mockResolvedValue(PAYMENT)
        const zalo = { label: "zalo", status: "skipped" as const }
        renewal.zaloWindowSteps.mockResolvedValue([zalo])

        const result = await run("contract_renewal", { ...context(), body: "Body" }, { contract_id: "c-1" })

        expect(renewal.paymentOf).toHaveBeenCalledWith("ws-1", CONTRACT, "l-1", "Body")
        expect(renewal.zaloWindowSteps).toHaveBeenCalledWith(CONVERSATION)
        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                vars: { ten_khach: "An", ten_goi: "Gold", ngay_het_han: "20/10/2026", ...PAYMENT.vars },
                fixedTail: "Hoa don: INV-202611-0003\nQR: qr",
                keepExact: undefined,
            }),
        )
        expect(result.steps.map((step) => step.label)).toEqual(["invoice", "zalo", "sent", "renewal.taskStep{}"])
        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ evidence: "c-1:2026-10-20:INV-202611-0003" }),
        )
    })

    it("keeps the invoice step when the customer has no chat, so sales can quote it", async () => {
        const { run, messages, renewal } = await build(readingOf({ getRawOne: CONTRACT }).em)
        renewal.paymentOf.mockResolvedValue(PAYMENT)
        messages.conversationOf.mockResolvedValue(null)

        const result = await run("contract_renewal", context(), { contract_id: "c-1" })

        expect(renewal.zaloWindowSteps).not.toHaveBeenCalled()
        expect(result.steps.map((step) => step.label)).toEqual([
            "invoice",
            "renewal.notMessaged{}",
            "renewal.taskStep{}",
        ])
    })
})
