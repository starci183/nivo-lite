import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MockEntityManager } from "@starci/jest-preset"
import type { RunResult } from "@modules/domain/automation-runs"
import { AutomationCareExecutorsService } from "./automation-care-executors.service"
import { AutomationMessagesService } from "./automation-messages.service"
import { AUTOMATION_OFFICE } from "./automations.decorators"
import type { AutomationOffice, ExecutorContext, ExecutorMap, ExecutorPayload } from "./automation-ports.contracts"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
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

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

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
const SENT: RunResult = { status: "done", steps: [{ label: "sent", status: "done" }], evidence: "ok" }
const CONVERSATION = { id: "cv-1", channel: "web", handled_by: null, visitor_name: "Khach", lead_id: null }

const context = (config: ExecutorContext["config"] = {}): ExecutorContext => ({
    workspaceId: "ws-1",
    pipeline: buildPipelineRow(),
    def: buildTemplate(),
    config,
    body: "Hi",
    shop: buildShop(),
})

const runner =
    (executors: ExecutorMap) =>
    (key: string, ctx: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> =>
        executors[key]?.(ctx, payload) ?? Promise.reject(new TypeError(`no executor for ${key}`))

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const office = mock<AutomationOffice>()
    const messages = mock<AutomationMessagesService>()
    messages.say.mockImplementation((key, params) => `${key}${JSON.stringify(params ?? {})}`)
    messages.skipped.mockImplementation((detail) => ({
        status: "skipped",
        steps: [{ label: "skip", status: "skipped", detail }],
    }))
    messages.noChannel.mockImplementation((name) => ({
        status: "skipped",
        steps: [{ label: "skip", status: "skipped", detail: `noChannel:${name}` }],
    }))
    messages.leadOf.mockResolvedValue(LEAD)
    messages.lead.mockResolvedValue(LEAD)
    messages.conversationOf.mockResolvedValue(CONVERSATION)
    messages.composeAndSend.mockResolvedValue(SENT)
    messages.firstStaffName.mockResolvedValue("Lan")
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationCareExecutorsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AUTOMATION_OFFICE, useValue: office },
            { provide: AutomationMessagesService, useValue: messages },
        ],
    }).compile()
    const service = moduleRef.get(AutomationCareExecutorsService)
    return { service, office, messages, run: runner(service.executors()) }
}

describe("AutomationCareExecutorsService thank_payment", () => {
    const payload = { lead_id: "l-1", amount_vnd: 350000, invoice_id: "i-1", invoice_no: "HD1", at: NOW }
    it("thanks a payment through the gate", async () => {
        const em = readingOf({ getRawOne: undefined }).em
        const { run, messages } = await build(em)

        await expect(run("thank_payment", context(), payload)).resolves.toBe(SENT)

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                action: "send_care",
                conversationId: "cv-1",
                dedupe: "thank:i-1",
                forceAsk: false,
                vars: objectLike({ ten_khach: "An", ma_phieu: "HD1" }),
            }),
        )
        expect(readsOf(em)[0]?.callsOf("andWhere")).toContainEqual([
            expect.stringContaining("w.created_at >= :since"),
            { since: "2026-10-12T09:50:00.000Z" },
        ])
    })

    it("falls back on the lead for the dedupe key and on the clock when the payment has no date", async () => {
        const em = readingOf({ getRawOne: undefined }).em
        const { run, messages } = await build(em)

        await run("thank_payment", context(), { lead_id: "l-1" })

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ dedupe: "thank:l-1" }),
        )
        expect(readsOf(em)[0]?.callsOf("andWhere")).toContainEqual([
            expect.stringContaining("w.created_at >= :since"),
            { since: "2026-10-12T09:40:00.000Z" },
        ])
    })

    it("skips a payment below the minimum amount", async () => {
        const { run } = await build()

        const result = await run("thank_payment", context({ minAmount: 500000 }), payload)

        expect(result.status).toBe("skipped")
    })

    it("skips a missing lead, missing conversation and an existing built-in thank-you", async () => {
        const em = readingOf({ getRawOne: { id: "w-9" } }).em
        const { run, messages } = await build(em)

        messages.leadOf.mockResolvedValueOnce(null)
        await expect(run("thank_payment", context(), payload)).resolves.toMatchObject({ status: "skipped" })

        messages.conversationOf.mockResolvedValueOnce(null)
        await expect(run("thank_payment", context(), payload)).resolves.toMatchObject({
            steps: [{ detail: "noChannel:An" }],
        })

        await expect(run("thank_payment", context(), payload)).resolves.toEqual({
            status: "skipped",
            steps: [
                { label: "step.skipped{}", status: "skipped", detail: "thank.alreadyThanked{}", workItemId: "w-9" },
            ],
        })
        expect(messages.composeAndSend).not.toHaveBeenCalled()
    })
})
describe("AutomationCareExecutorsService ask_review", () => {
    it("asks a paying customer for a review", async () => {
        const { run, messages } = await build()

        await expect(
            run("ask_review", context(), {
                lead_id: "l-1",
                invoice_id: "i-1",
                invoice_no: "HD1",
                amount_vnd: 1000,
            }),
        ).resolves.toBe(SENT)
        await run("ask_review", context(), { lead_id: "l-1" })

        expect(messages.composeAndSend).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({ dedupe: "review:i-1" }),
        )
        expect(messages.composeAndSend).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({ dedupe: "review:l-1" }),
        )
    })

    it("skips when there is no lead or no conversation", async () => {
        const { run, messages } = await build()
        messages.leadOf.mockResolvedValueOnce(null)
        messages.conversationOf.mockResolvedValueOnce(null)

        await expect(run("ask_review", context(), {})).resolves.toMatchObject({ status: "skipped" })
        await expect(run("ask_review", context(), {})).resolves.toMatchObject({
            steps: [{ detail: "noChannel:An" }],
        })
    })
})
describe("AutomationCareExecutorsService nurture_leads", () => {
    it("follows up an open lead, numbering the follow-ups", async () => {
        const { run, messages } = await build()

        await expect(run("nurture_leads", context(), { lead_id: "l-1", k: 2, dedupe: "n:l-1:2" })).resolves.toBe(SENT)
        await run("nurture_leads", context(), { lead_id: "l-1", k: 3 })

        expect(messages.composeAndSend).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({ action: "send_follow_up", dedupe: "n:l-1:2" }),
        )
        expect(messages.composeAndSend).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({ dedupe: "nurture:l-1:3" }),
        )
    })

    it("skips a lead that is gone, won or lost, or without a conversation", async () => {
        const { run, messages } = await build()
        messages.leadOf.mockResolvedValueOnce(null)
        messages.leadOf.mockResolvedValueOnce({ ...LEAD, stage: "won" })
        messages.leadOf.mockResolvedValueOnce({ ...LEAD, stage: "lost" })
        messages.conversationOf.mockResolvedValueOnce(null)

        await run("nurture_leads", context(), {})
        await run("nurture_leads", context(), {})
        await run("nurture_leads", context(), {})
        await expect(run("nurture_leads", context(), {})).resolves.toMatchObject({
            steps: [{ detail: "noChannel:An" }],
        })

        expect(messages.skipped).toHaveBeenCalledTimes(3)
    })
})
describe("AutomationCareExecutorsService win_back", () => {
    it("invites a past customer back, always asking the owner, with the offer when there is one", async () => {
        const { run, messages } = await build()

        await expect(run("win_back", context({ offer: "10% off" }), { lead_id: "l-1", dedupe: "w:l-1" })).resolves.toBe(
            SENT,
        )
        await run("win_back", context(), { lead_id: "l-1", dedupe: "w:l-1" })

        expect(messages.composeAndSend).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            expect.objectContaining({
                forceAsk: true,
                summary: 'winback.summaryOffer{"name":"An","offer":"10% off"}',
                vars: { ten_khach: "An", nhu_cau: "hoa", uu_dai: "10% off" },
            }),
        )
        expect(messages.composeAndSend).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            expect.objectContaining({ summary: 'winback.summary{"name":"An","offer":""}' }),
        )
    })

    it("skips a lead that is gone or lost, or without a conversation", async () => {
        const { run, messages } = await build()
        messages.leadOf.mockResolvedValueOnce(null)
        messages.leadOf.mockResolvedValueOnce({ ...LEAD, stage: "lost" })
        messages.conversationOf.mockResolvedValueOnce(null)

        await run("win_back", context(), {})
        await run("win_back", context(), {})
        await expect(run("win_back", context(), {})).resolves.toMatchObject({
            steps: [{ detail: "noChannel:An" }],
        })
    })
})
describe("AutomationCareExecutorsService debt_reminder", () => {
    const payload = { lead_id: "l-1", k: 1, amount_vnd: 250000, invoice_no: "HD1", dedupe: "debt:i-1:1" }
    it("reminds a customer about the first overdue invoice through the gate", async () => {
        const { run, messages, office } = await build()

        await expect(run("debt_reminder", context(), payload)).resolves.toEqual(SENT)

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ dedupe: "debt:i-1:1", action: "send_care" }),
        )
        expect(office.postLine).not.toHaveBeenCalled()
    })

    it("tells the owner from the second reminder on, and puts that step first", async () => {
        const { run, office } = await build()

        const result = await run("debt_reminder", context(), { ...payload, k: 2 })

        expect(office.postLine).toHaveBeenCalledTimes(1)
        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ kind: "automation.owner_notified", evidence: "HD1" }),
        )
        expect(result.steps.map((step) => step.label)).toEqual(["step.ownerNotified{}", "sent"])
    })

    it("treats a missing reminder number as the first", async () => {
        const { run, office } = await build()

        await run("debt_reminder", context(), { lead_id: "l-1" })

        expect(office.postLine).not.toHaveBeenCalled()
    })

    it("skips when there is no lead, and when the customer has no chat it still tells the owner", async () => {
        const { run, messages } = await build()
        messages.leadOf.mockResolvedValueOnce(null)
        messages.conversationOf.mockResolvedValue(null)

        await expect(run("debt_reminder", context(), payload)).resolves.toMatchObject({ status: "skipped" })
        await expect(run("debt_reminder", context(), payload)).resolves.toMatchObject({
            status: "skipped",
            steps: [{ label: "step.skipped{}", status: "skipped" }],
        })
        await expect(run("debt_reminder", context(), { ...payload, k: 2 })).resolves.toMatchObject({
            status: "done",
            steps: [{ label: "step.ownerNotified{}" }, { label: "step.skipped{}" }],
        })
    })
})
describe("AutomationCareExecutorsService after_hours", () => {
    const payload = { conversation_id: "cv-1", dedupe: "after:cv-1", text: "t".repeat(300) }
    it("answers a lead outside the opening hours, opens a call-back task and tells the owner", async () => {
        const { run, messages, office } = await build(readingOf({ getRawOne: { ...CONVERSATION, lead_id: "l-1" } }).em)

        const result = await run("after_hours", context(), payload)

        expect(messages.composeAndSend).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ action: "reply_customer", dedupe: "after:cv-1", vars: { ten_khach: "An" } }),
        )
        expect(office.openFollowUp).toHaveBeenCalledWith("ws-1", {
            leadId: "l-1",
            title: 'after.taskTitle{"name":"An"}',
            ownerName: "Lan",
            nextAction: 'after.taskActionPhone{"name":"An","phone":"0900"}',
            dueAt: "2026-10-13T02:00:00.000Z",
        })
        expect(office.postLine).toHaveBeenCalledWith(
            "ws-1",
            `after.officeLine${JSON.stringify({ name: "An", text: "t".repeat(160) })}`,
            "l-1",
        )
        expect(result).toEqual({
            status: "done",
            steps: [
                { label: "sent", status: "done" },
                { label: "after.taskStep{}", status: "done", detail: 'after.taskDetail{"staff":"Lan"}' },
                { label: "after.officeStep{}", status: "done" },
            ],
            evidence: "ok",
        })
    })

    it("takes the lead from the payload, a standard staff name and the action without a phone", async () => {
        const { run, messages, office } = await build(readingOf({ getRawOne: CONVERSATION }).em)
        messages.leadOf.mockResolvedValue({ ...LEAD, phone: null })
        messages.firstStaffName.mockResolvedValue(null)

        await run("after_hours", context(), { lead_id: "l-1", conversation_id: "cv-1" })

        expect(messages.leadOf).toHaveBeenCalledWith("ws-1", "l-1")
        expect(office.openFollowUp).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                ownerName: "after.staffFallback{}",
                nextAction: 'after.taskAction{"name":"An","phone":""}',
            }),
        )
    })
})
describe("AutomationCareExecutorsService after_hours", () => {
    const payload = { conversation_id: "cv-1", dedupe: "after:cv-1", text: "t".repeat(300) }
    it("replies without a lead to a visitor, and skips the call-back task", async () => {
        const { run, messages, office } = await build(readingOf({ getRawOne: CONVERSATION }).em)
        messages.leadOf.mockResolvedValue(null)
        messages.replyWithoutLead.mockResolvedValue({ status: "waiting_approval", steps: [], evidence: undefined })

        const result = await run("after_hours", context(), payload)

        expect(messages.replyWithoutLead).toHaveBeenCalledWith(expect.anything(), {
            conversationId: "cv-1",
            name: "Khach",
            dedupe: "after:cv-1",
        })
        expect(office.openFollowUp).not.toHaveBeenCalled()
        expect(office.postLine).toHaveBeenCalledWith(
            "ws-1",
            `after.officeLine${JSON.stringify({ name: "Khach", text: "t".repeat(160) })}`,
            null,
        )
        expect(result).toEqual({
            status: "waiting_approval",
            steps: [{ label: "after.officeStep{}", status: "done" }],
            evidence: null,
        })
    })

    it("calls an unnamed visitor by a standard word", async () => {
        const { run, messages } = await build(readingOf({ getRawOne: { ...CONVERSATION, visitor_name: null } }).em)
        messages.leadOf.mockResolvedValue(null)
        messages.replyWithoutLead.mockResolvedValue(SENT)

        await run("after_hours", context(), payload)

        expect(messages.replyWithoutLead).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ name: "customer{}" }),
        )
    })

    it("skips a conversation that is gone or that a person took over", async () => {
        const gone = await build(readingOf({ getRawOne: undefined }).em)
        const taken = await build(readingOf({ getRawOne: { ...CONVERSATION, handled_by: "u-1" } }).em)

        await expect(gone.run("after_hours", context(), payload)).resolves.toMatchObject({ status: "skipped" })
        await expect(taken.run("after_hours", context(), payload)).resolves.toMatchObject({ status: "skipped" })
        expect(gone.messages.skipped).toHaveBeenCalledWith("after.noConversation{}")
        expect(taken.messages.skipped).toHaveBeenCalledWith("after.handled{}")
    })
})
