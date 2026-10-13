import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import type { RunResult } from "@modules/domain/automation-runs"
import { AutomationCareExecutorsService } from "./automation-care-executors.service"
import { AutomationMessagesService } from "./automation-messages.service"
import type { AutomationOffice, ExecutorContext, ExecutorMap, ExecutorPayload } from "./automation-ports.contracts"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { SELECT_BUILT_IN_CARE, SELECT_CONVERSATION } from "./persistence/automation-readers.sql"
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

const build = (em: MockEntityManager = mockEntityManager()) => {
    const office = mock<AutomationOffice>()
    const runs = mock<AutomationRunsService>()
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
    const service = new AutomationCareExecutorsService(em, new FakeClock(NOW), office, runs, messages)
    return { service, office, runs, messages, run: runner(service.executors()) }
}

describe("AutomationCareExecutorsService", () => {
    describe("checkFeedback", () => {
        const check = {
            context: context(),
            runId: "r-1",
            runPayload: { lead_id: "l-1" },
            feedback: "x".repeat(400),
            leadId: "l-1",
        }

        it("does nothing for feedback that is not negative", async () => {
            const { service, messages, runs } = build()
            messages.isNegative.mockResolvedValue(false)

            await expect(service.checkFeedback(check)).resolves.toBe(false)

            expect(runs.markPayload).not.toHaveBeenCalled()
        })

        it("marks the run and tags the owner in Office when the feedback is negative", async () => {
            const { service, messages, runs, office } = build()
            messages.isNegative.mockResolvedValue(true)

            await expect(service.checkFeedback(check)).resolves.toBe(true)

            expect(runs.markPayload).toHaveBeenCalledWith("r-1", {
                lead_id: "l-1",
                alerted: { text: "x".repeat(300), at: NOW },
            })
            expect(office.postLine).toHaveBeenCalledWith(
                "ws-1",
                `feedback.line${JSON.stringify({ name: "An", text: "x".repeat(200) })}`,
                "l-1",
            )
            expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
                leadId: "l-1",
                kind: "automation.negative_review",
                actor: "feedback.actor{}",
                summary: 'feedback.summary{"name":"An"}',
                evidence: "x".repeat(300),
            })
        })

        it("calls the customer by a standard word when the lead is gone", async () => {
            const { service, messages } = build()
            messages.isNegative.mockResolvedValue(true)
            messages.lead.mockResolvedValue(null)

            await service.checkFeedback(check)

            expect(messages.say).toHaveBeenCalledWith("feedback.summary", { name: "customer{}" })
        })
    })

    describe("thank_payment", () => {
        const payload = { lead_id: "l-1", amount_vnd: 350000, invoice_id: "i-1", invoice_no: "HD1", at: NOW }

        it("thanks a payment through the gate", async () => {
            const em = mockEntityManager({ query: [SELECT_BUILT_IN_CARE, []] })
            const { run, messages } = build(em)

            await expect(run("thank_payment", context(), payload)).resolves.toBe(SENT)

            expect(messages.composeAndSend).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    action: "send_care",
                    conversationId: "cv-1",
                    dedupe: "thank:i-1",
                    forceAsk: false,
                    vars: expect.objectContaining({ ten_khach: "An", ma_phieu: "HD1" }),
                }),
            )
            expect(em.query).toHaveBeenCalledWith(SELECT_BUILT_IN_CARE, ["ws-1", "l-1", "2026-10-12T09:50:00.000Z"])
        })

        it("falls back on the lead for the dedupe key and on the clock when the payment has no date", async () => {
            const em = mockEntityManager({ query: [SELECT_BUILT_IN_CARE, []] })
            const { run, messages } = build(em)

            await run("thank_payment", context(), { lead_id: "l-1" })

            expect(messages.composeAndSend).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ dedupe: "thank:l-1" }),
            )
            expect(em.query).toHaveBeenCalledWith(SELECT_BUILT_IN_CARE, ["ws-1", "l-1", "2026-10-12T09:40:00.000Z"])
        })

        it("skips a payment below the minimum amount", async () => {
            const { run } = build()

            const result = await run("thank_payment", context({ minAmount: 500000 }), payload)

            expect(result.status).toBe("skipped")
        })

        it("skips when there is no lead, when it has no conversation and when the built-in care message already thanked it", async () => {
            const em = mockEntityManager({ query: [SELECT_BUILT_IN_CARE, [{ id: "w-9" }]] })
            const { run, messages } = build(em)

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

    describe("ask_review", () => {
        it("asks a paying customer for a review", async () => {
            const { run, messages } = build()

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
            const { run, messages } = build()
            messages.leadOf.mockResolvedValueOnce(null)
            messages.conversationOf.mockResolvedValueOnce(null)

            await expect(run("ask_review", context(), {})).resolves.toMatchObject({ status: "skipped" })
            await expect(run("ask_review", context(), {})).resolves.toMatchObject({
                steps: [{ detail: "noChannel:An" }],
            })
        })
    })

    describe("nurture_leads", () => {
        it("follows up an open lead, numbering the follow-ups", async () => {
            const { run, messages } = build()

            await expect(run("nurture_leads", context(), { lead_id: "l-1", k: 2, dedupe: "n:l-1:2" })).resolves.toBe(
                SENT,
            )
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
            const { run, messages } = build()
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

    describe("win_back", () => {
        it("invites a past customer back, always asking the owner, with the offer when there is one", async () => {
            const { run, messages } = build()

            await expect(
                run("win_back", context({ offer: "10% off" }), { lead_id: "l-1", dedupe: "w:l-1" }),
            ).resolves.toBe(SENT)
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
            const { run, messages } = build()
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

    describe("debt_reminder", () => {
        const payload = { lead_id: "l-1", k: 1, amount_vnd: 250000, invoice_no: "HD1", dedupe: "debt:i-1:1" }

        it("reminds a customer about the first overdue invoice through the gate", async () => {
            const { run, messages, office } = build()

            await expect(run("debt_reminder", context(), payload)).resolves.toEqual(SENT)

            expect(messages.composeAndSend).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ dedupe: "debt:i-1:1", action: "send_care" }),
            )
            expect(office.postLine).not.toHaveBeenCalled()
        })

        it("tells the owner from the second reminder on, and puts that step first", async () => {
            const { run, office } = build()

            const result = await run("debt_reminder", context(), { ...payload, k: 2 })

            expect(office.postLine).toHaveBeenCalledTimes(1)
            expect(office.logEvidence).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ kind: "automation.owner_notified", evidence: "HD1" }),
            )
            expect(result.steps.map((step) => step.label)).toEqual(["step.ownerNotified{}", "sent"])
        })

        it("treats a missing reminder number as the first", async () => {
            const { run, office } = build()

            await run("debt_reminder", context(), { lead_id: "l-1" })

            expect(office.postLine).not.toHaveBeenCalled()
        })

        it("skips when there is no lead, and when the customer has no chat it still tells the owner", async () => {
            const { run, messages } = build()
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

    describe("after_hours", () => {
        const payload = { conversation_id: "cv-1", dedupe: "after:cv-1", text: "t".repeat(300) }
        const withConversation = (row: object = CONVERSATION) =>
            mockEntityManager({ query: [SELECT_CONVERSATION, [row]] })

        it("answers a lead outside the opening hours, opens a call-back task and tells the owner", async () => {
            const { run, messages, office } = build(withConversation({ ...CONVERSATION, lead_id: "l-1" }))

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
            const { run, messages, office } = build(withConversation())
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

        it("replies without a lead to a visitor, and skips the call-back task", async () => {
            const { run, messages, office } = build(withConversation())
            messages.leadOf.mockResolvedValue(null)
            messages.replyWithoutLead.mockResolvedValue({ status: "waiting_approval", steps: [], evidence: undefined })

            const result = await run("after_hours", context(), payload)

            expect(messages.replyWithoutLead).toHaveBeenCalledWith(expect.anything(), {
                conversationId: "cv-1",
                name: "Khach",
                dedupe: "after:cv-1",
            })
            expect(office.openFollowUp).not.toHaveBeenCalled()
            expect(office.postLine).toHaveBeenCalledWith("ws-1", expect.any(String), null)
            expect(result).toEqual({
                status: "waiting_approval",
                steps: [{ label: "after.officeStep{}", status: "done" }],
                evidence: null,
            })
        })

        it("calls an unnamed visitor by a standard word", async () => {
            const { run, messages } = build(withConversation({ ...CONVERSATION, visitor_name: null }))
            messages.leadOf.mockResolvedValue(null)
            messages.replyWithoutLead.mockResolvedValue(SENT)

            await run("after_hours", context(), payload)

            expect(messages.replyWithoutLead).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ name: "customer{}" }),
            )
        })

        it("skips a conversation that is gone or that a person took over", async () => {
            const gone = build(mockEntityManager({ query: [SELECT_CONVERSATION, []] }))
            const taken = build(withConversation({ ...CONVERSATION, handled_by: "u-1" }))

            await expect(gone.run("after_hours", context(), payload)).resolves.toMatchObject({ status: "skipped" })
            await expect(taken.run("after_hours", context(), payload)).resolves.toMatchObject({ status: "skipped" })
            expect(gone.messages.skipped).toHaveBeenCalledWith("after.noConversation{}")
            expect(taken.messages.skipped).toHaveBeenCalledWith("after.handled{}")
        })
    })
})
