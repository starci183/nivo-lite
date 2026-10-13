import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { RunResult } from "@modules/domain/automation-runs"
import { AutomationMessagesService } from "./automation-messages.service"
import { AutomationOperationsExecutorsService } from "./automation-operations-executors.service"
import type {
    AutomationOffice,
    AutomationOwnerChat,
    AutomationRecords,
    ExecutorContext,
    ExecutorMap,
    ExecutorPayload,
} from "./automation-ports.contracts"
import { AUTOMATION_OFFICE, AUTOMATION_OWNER_CHAT, AUTOMATION_RECORDS } from "./automations.decorators"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { SELECT_CONTRACT, SELECT_DAY_FIGURES, SELECT_ORDER } from "./persistence/automation-readers.sql"
import type { LeadReadRow } from "./persistence/automations.rows"

const NOW = "2026-10-12T10:00:00.000Z"
const LEAD: LeadReadRow = {
    id: "l-1",
    contact_name: "An",
    company: "",
    channel: "web",
    need: "hoa",
    stage: "new",
    phone: "0900",
    email: null,
    origin: null,
}
const SENT: RunResult = { status: "waiting_approval", steps: [{ label: "sent", status: "waiting" }], evidence: "wait" }
const CONVERSATION = { id: "cv-1", channel: "web", handled_by: null, visitor_name: null, lead_id: "l-1" }
const CONTRACT = {
    id: "c-1",
    customer_name: "Binh",
    lead_id: "l-1",
    plan: "Gold",
    ends_on: "2026-10-20",
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

const build = async (em: MockEntityManager = mockEntityManager(), ownerChat = true) => {
    const clock = new FakeClock(NOW)
    const office = mock<AutomationOffice>()
    office.openFollowUp.mockResolvedValue(true)
    const records = mock<AutomationRecords>()
    records.createLead.mockResolvedValue("l-new")
    const chat = mock<AutomationOwnerChat>()
    chat.sendToOwner.mockResolvedValue(ownerChat)
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationOperationsExecutorsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: AUTOMATION_OFFICE, useValue: office },
            { provide: AUTOMATION_RECORDS, useValue: records },
            { provide: AUTOMATION_OWNER_CHAT, useValue: chat },
            { provide: AutomationMessagesService, useValue: messages },
        ],
    }).compile()
    const service = moduleRef.get(AutomationOperationsExecutorsService)
    return { office, records, chat, messages, run: runner(service.executors()) }
}

describe("AutomationOperationsExecutorsService", () => {
    describe("daily_report", () => {
        const figures = {
            new_leads: 3,
            confirmed_orders: 2,
            confirmed_total: "900000",
            money_in: "500000",
            won_leads: 4,
            waiting: ["a".repeat(120), null, "c", "d"],
        }

        it("posts the day to Office with the deals, the money and what waits", async () => {
            const em = mockEntityManager({ query: [SELECT_DAY_FIGURES, [figures]] })
            const { run, office } = await build(em)

            const result = await run("daily_report", context(), { day: "2026-10-11" })

            expect(em.query).toHaveBeenCalledWith(SELECT_DAY_FIGURES, ["ws-1", "2026-10-10T17:00:00.000Z"])
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
            ])
            expect(result).toMatchObject({
                status: "done",
                steps: [{ label: "report.posted{}", status: "done", message: text }],
                evidence: expect.stringContaining('"deals":4'),
            })
        })

        it("reports an empty day: today, no deals, nothing waiting", async () => {
            const em = mockEntityManager({ query: [SELECT_DAY_FIGURES, []] })
            const { run, office } = await build(em)

            const result = await run("daily_report", context(), {})

            expect(em.query).toHaveBeenCalledWith(SELECT_DAY_FIGURES, ["ws-1", "2026-10-11T17:00:00.000Z"])
            const text = (office.postLine.mock.calls[0] ?? [])[1] ?? ""
            expect(text).toContain('report.deals{"count":0}')
            expect(text).toContain("report.waitingNone{}")
            expect(result.steps).toHaveLength(1)
        })

        it("also sends the report to the chat of the owner when asked", async () => {
            const em = mockEntityManager({ query: [SELECT_DAY_FIGURES, [figures]] })
            const { run, chat } = await build(em)

            const result = await run("daily_report", context({ toOwnerChat: true }), {})

            expect(chat.sendToOwner).toHaveBeenCalledWith("ws-1", expect.stringContaining("report.title"))
            expect(result.steps[1]).toEqual({ label: "report.chatSent{}", status: "done" })
        })

        it("says the chat was skipped when it cannot be reached or is not bound", async () => {
            const em = mockEntityManager({ query: [SELECT_DAY_FIGURES, [figures]] })
            const unreachable = await build(em)
            unreachable.chat.sendToOwner.mockResolvedValue(false)
            const unbound = await build(em, false)

            const first = await unreachable.run("daily_report", context({ toOwnerChat: true }), {})
            const second = await unbound.run("daily_report", context({ toOwnerChat: true }), {})

            for (const result of [first, second]) {
                expect(result.steps[1]).toEqual({
                    label: "report.chatSkipped{}",
                    status: "skipped",
                    detail: "report.chatSkippedDetail{}",
                })
            }
        })
    })

    describe("delivery_notice", () => {
        const order = {
            id: "o-1",
            order_no: "DH1",
            lead_id: "l-1",
            shipped_at: "2026-10-11T00:00:00.000Z",
            carrier: " GHN ",
            tracking_code: " ABC ",
        }

        it("tells the customer the order left, with the carrier and the tracking code", async () => {
            const em = mockEntityManager({ query: [SELECT_ORDER, [order]] })
            const { run, messages } = await build(em)

            await expect(run("delivery_notice", context(), { order_id: "o-1" })).resolves.toBe(SENT)

            expect(messages.composeAndSend).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    dedupe: "ship:o-1",
                    caseNote: expect.stringContaining("delivery.caseTracking"),
                    vars: { ten_khach: "An", ma_phieu: "DH1", hang_van_chuyen: "GHN", ma_van_don: "ABC" },
                }),
            )
        })

        it("falls back on standard words when the order has no carrier or tracking code", async () => {
            const em = mockEntityManager({ query: [SELECT_ORDER, [{ ...order, carrier: null, tracking_code: null }]] })
            const { run, messages } = await build(em)

            await run("delivery_notice", context(), { order_id: "o-1" })

            expect(messages.composeAndSend).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    summary: expect.stringContaining("delivery.carrierFallback"),
                    caseNote: expect.stringContaining("delivery.case{"),
                }),
            )
        })

        it("skips an order that is not shipped, has no customer or no chat", async () => {
            const missing = await build(mockEntityManager({ query: [SELECT_ORDER, []] }))
            const unshipped = await build(
                mockEntityManager({ query: [SELECT_ORDER, [{ ...order, shipped_at: null }]] }),
            )
            const noLead = await build(mockEntityManager({ query: [SELECT_ORDER, [{ ...order, lead_id: null }]] }))
            noLead.messages.leadOf.mockResolvedValue(null)
            const noChat = await build(mockEntityManager({ query: [SELECT_ORDER, [order]] }))
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

    describe("contract_renewal", () => {
        it("drafts the renewal message, asks the owner and opens a follow-up for sales", async () => {
            const { run, messages, office } = await build(mockEntityManager({ query: [SELECT_CONTRACT, [CONTRACT]] }))

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
                mockEntityManager({
                    query: [SELECT_CONTRACT, [{ ...CONTRACT, ends_on: "2026-10-13", plan: "  " }]],
                }),
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

        it("only notes a follow-up that was already open, and uses the standard staff name and the action without a phone", async () => {
            const { run, messages, office } = await build(mockEntityManager({ query: [SELECT_CONTRACT, [CONTRACT]] }))
            office.openFollowUp.mockResolvedValue(false)
            messages.firstStaffName.mockResolvedValue(null)
            messages.lead.mockResolvedValue({ ...LEAD, phone: null })

            const result = await run("contract_renewal", context(), { contract_id: "c-1" })

            expect(office.postLine).not.toHaveBeenCalled()
            expect(office.openFollowUp).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({
                    ownerName: "after.staffFallback{}",
                    nextAction: expect.stringContaining("renewal.taskAction{"),
                }),
            )
            expect(result.steps).toHaveLength(1)
        })

        it("does not message a customer without a chat but still opens the follow-up", async () => {
            const { run, messages } = await build(mockEntityManager({ query: [SELECT_CONTRACT, [CONTRACT]] }))
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
                mockEntityManager({ query: [SELECT_CONTRACT, [{ ...CONTRACT, lead_id: null }]] }),
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
            const gone = await build(mockEntityManager({ query: [SELECT_CONTRACT, []] }))
            const noId = await build(mockEntityManager())
            const ended = await build(
                mockEntityManager({ query: [SELECT_CONTRACT, [{ ...CONTRACT, status: "ended" }]] }),
            )
            const moved = await build(mockEntityManager({ query: [SELECT_CONTRACT, [CONTRACT]] }))
            const noLead = await build(mockEntityManager({ query: [SELECT_CONTRACT, [CONTRACT]] }))
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
})
