import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MockEntityManager } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Composition } from "./automation-messages.contracts"
import { AutomationMessagesService } from "./automation-messages.service"
import type {
    AutomationGate,
    AutomationOffice,
    AutomationText,
    ExecutorContext,
    GateOutcome,
} from "./automation-ports.contracts"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { AUTOMATION_GATE, AUTOMATION_OFFICE, AUTOMATION_TEXT } from "./automations.decorators"
import { AutomationsErrorCode } from "./errors/automations.error"
import { SELECT_FIRST_STAFF, SELECT_LATEST_CONVERSATION, SELECT_LEAD } from "./persistence/automation-readers.sql"
import type { LeadReadRow } from "./persistence/automations.rows"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const textLike = (text: string): unknown => expect.stringContaining(text)

const LEAD: LeadReadRow = {
    id: "l-1",
    contact_name: "An",
    company: "",
    channel: "web",
    need: "hoa",
    stage: "new",
    phone: "0900",
    email: null,
}

const outcome = (overrides: Partial<GateOutcome> = {}): GateOutcome => ({
    itemId: "w-1",
    state: "sent",
    summary: "Da gui",
    reason: null,
    error: null,
    autoApproved: false,
    ...overrides,
})

const composition = (overrides: Partial<Composition> = {}): Composition => ({
    action: "send_care",
    lead: LEAD,
    conversationId: "cv-1",
    dedupe: "d-1",
    summary: "Cam on",
    caseNote: "Vua thanh toan",
    vars: { ten_khach: "An" },
    forceAsk: false,
    ...overrides,
})

const context = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
    workspaceId: "ws-1",
    pipeline: buildPipelineRow({ id: "p-1" }),
    def: buildTemplate({ name: { vi: "Cam on", en: "Thanks" }, contentMode: "fixed" }),
    config: {},
    body: "Chao {ten_khach} tu {ten_shop}",
    shop: buildShop({ shop: "Tiem Hoa", hours: "08:00 - 21:00" }),
    ...overrides,
})

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => {
        if (key === "automations.pattern.negative") return "bad|terrible"
        if (key === "automations.neutral.ten_khach") return "ban"
        return `${key.replace("automations.", "")}${JSON.stringify(params)}`
    })
    const gate = mock<AutomationGate>()
    gate.submit.mockResolvedValue(outcome())
    const office = mock<AutomationOffice>()
    const text = mock<AutomationText>()
    text.generate.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationMessagesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AUTOMATION_GATE, useValue: gate },
            { provide: AUTOMATION_OFFICE, useValue: office },
            { provide: AUTOMATION_TEXT, useValue: text },
        ],
    }).compile()
    const service = moduleRef.get(AutomationMessagesService)
    return { service, gate, office, text }
}

describe("AutomationMessagesService words", () => {
    it("says a text of the catalog in Vietnamese and names the actor", async () => {
        const { service } = await build()

        expect(service.say("actor")).toBe("actor{}")
        expect(service.say("noChannel", { name: "An" })).toBe('noChannel{"name":"An"}')
        expect(service.actorOf(buildTemplate({ name: { vi: "Cam on", en: "Thanks" } }))).toBe("actor{} · Cam on")
    })

    it("explains a run that did nothing", async () => {
        const { service } = await build()

        expect(service.skipped("vi sao")).toEqual({
            status: "skipped",
            steps: [{ label: "step.skipped{}", status: "skipped", detail: "vi sao" }],
        })
        expect(service.noChannel("An").steps[0]?.detail).toBe('noChannel{"name":"An"}')
    })
})
describe("AutomationMessagesService loaders", () => {
    it("reads a lead, the conversation of a lead and the first staff member", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_LEAD, [LEAD]],
                [SELECT_LATEST_CONVERSATION, [{ id: "cv-1" }]],
                [SELECT_FIRST_STAFF, [{ name: "Lan" }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.lead("ws-1", "l-1")).resolves.toEqual(LEAD)
        await expect(service.leadOf("ws-1", "l-1")).resolves.toEqual(LEAD)
        await expect(service.conversationOf("ws-1", "l-1")).resolves.toEqual({ id: "cv-1" })
        await expect(service.firstStaffName("ws-1")).resolves.toBe("Lan")
    })

    it("answers none when there is nothing to read", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_LEAD, []],
                [SELECT_LATEST_CONVERSATION, []],
                [SELECT_FIRST_STAFF, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.lead("ws-1", "l-1")).resolves.toBeNull()
        await expect(service.leadOf("ws-1", "")).resolves.toBeNull()
        await expect(service.conversationOf("ws-1", "l-1")).resolves.toBeNull()
        await expect(service.firstStaffName("ws-1")).resolves.toBeNull()
    })
})
describe("AutomationMessagesService composeAndSend", () => {
    it("fills the approved wording and puts it through the gate as a care message", async () => {
        const { service, gate } = await build()

        const result = await service.composeAndSend(context(), composition())

        expect(gate.submit).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            actor: "actor{} · Cam on",
            action: "send_care",
            subject: { type: "lead", id: "l-1" },
            leadId: "l-1",
            dedupeKey: "automation:p-1:d-1",
            summary: "Cam on",
            draft: "Chao An tu Tiem Hoa",
            fields: { customer: "An", contact: "0900" },
            forceAsk: false,
            autoApprove: false,
        })
        expect(result).toEqual({
            status: "done",
            steps: [
                { label: "step.filled{}", status: "done", message: "Chao An tu Tiem Hoa" },
                {
                    label: "step.sent{}",
                    status: "done",
                    detail: "Da gui",
                    workItemId: "w-1",
                    message: "Chao An tu Tiem Hoa",
                },
            ],
            evidence: "Da gui",
        })
    })

    it("sends a reply on the conversation with the contact it has", async () => {
        const { service, gate } = await build()
        const lead = { ...LEAD, phone: null, email: "an@x.vn" }

        await service.composeAndSend(context(), composition({ action: "reply_customer", lead }))
        await service.composeAndSend(context(), composition({ lead: { ...LEAD, phone: null, email: null } }))

        expect(gate.submit).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                subject: { type: "conversation", id: "cv-1" },
                fields: { customer: "An", contact: "an@x.vn", conversation_id: "cv-1", question: "" },
            }),
        )
        expect(gate.submit).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ fields: { customer: "An", contact: "website" } }),
        )
    })
})
describe("AutomationMessagesService composeAndSend", () => {
    it("lets the owner's send by itself approve the message, unless the owner must decide", async () => {
        const { service, gate, office } = await build()
        gate.submit.mockResolvedValue(outcome({ autoApproved: true, summary: null }))
        const auto = context({ pipeline: buildPipelineRow({ id: "p-1", auto_send: true }) })

        const result = await service.composeAndSend(auto, composition())
        await service.composeAndSend(auto, composition({ forceAsk: true }))

        expect(gate.submit).toHaveBeenNthCalledWith(1, expect.objectContaining({ autoApprove: true }))
        expect(gate.submit).toHaveBeenNthCalledWith(2, expect.objectContaining({ autoApprove: false, forceAsk: true }))
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            leadId: "l-1",
            kind: "automation.auto_send",
            actor: "actor{} · Cam on",
            summary: 'gate.autoSend{"name":"Cam on"}',
        })
        expect(result.steps[1]).toMatchObject({ label: "step.sent{}", detail: undefined })
    })

    it("waits for the owner and says why", async () => {
        const { service, gate } = await build()
        gate.submit.mockResolvedValueOnce(outcome({ state: "waiting", reason: "rule says ask" }))
        gate.submit.mockResolvedValueOnce(outcome({ state: "waiting", reason: null }))

        const first = await service.composeAndSend(context(), composition())
        const second = await service.composeAndSend(context(), composition())

        expect(first).toMatchObject({ status: "waiting_approval", evidence: "evidence.waiting{}" })
        expect(first.steps[1]).toMatchObject({
            label: "step.waiting{}",
            status: "waiting",
            detail: 'gate.reason{"reason":"rule says ask"}',
        })
        expect(second.steps[1]?.detail).toBe('gate.reason{"reason":"gate.reasonFallback{}"}')
    })

    it("skips a message the owner refused", async () => {
        const { service, gate } = await build()
        gate.submit.mockResolvedValue(outcome({ state: "rejected" }))

        await expect(service.composeAndSend(context(), composition())).resolves.toMatchObject({
            status: "skipped",
            steps: [{ label: "step.filled{}" }, { label: "step.rejected{}", status: "skipped" }],
        })
    })

    it("fails with the reason the gate gave, or a standard one", async () => {
        const { service, gate } = await build()
        gate.submit.mockResolvedValueOnce(outcome({ state: "failed", error: "smtp down" }))
        gate.submit.mockResolvedValueOnce(outcome({ state: "failed", error: null }))

        await expect(service.composeAndSend(context(), composition())).rejects.toMatchObject({
            code: AutomationsErrorCode.MessageNotSent,
            cause: objectLike({ message: "smtp down" }),
        })
        await expect(service.composeAndSend(context(), composition())).rejects.toMatchObject({
            cause: objectLike({ message: "error.notSent{}" }),
        })
    })
})
describe("AutomationMessagesService composeAndSend a message the model adapts to the case", () => {
    const perCase = context({ def: buildTemplate({ contentMode: "ai_per_case" }) })
    it("uses the text the model wrote when it is plain and complete", async () => {
        const { service, gate, text } = await build()
        text.generate.mockResolvedValue('  "Chao An, cam on ban"  ')

        const result = await service.composeAndSend(perCase, composition())

        expect(gate.submit).toHaveBeenCalledWith(expect.objectContaining({ draft: "Chao An, cam on ban" }))
        expect(result.steps[0]).toMatchObject({ label: "step.drafted{}" })
        expect(text.generate).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", purpose: "per_case" }),
        )
    })

    it("keeps the filled wording when the model answers nothing, or something it should not", async () => {
        const { service, gate, text } = await build()
        text.generate.mockResolvedValueOnce(null)
        text.generate.mockResolvedValueOnce("Chao {ten_khach} con thieu")

        await service.composeAndSend(perCase, composition())
        await service.composeAndSend(perCase, composition())

        expect(gate.submit).toHaveBeenNthCalledWith(1, expect.objectContaining({ draft: "Chao An tu Tiem Hoa" }))
        expect(gate.submit).toHaveBeenNthCalledWith(2, expect.objectContaining({ draft: "Chao An tu Tiem Hoa" }))
    })

    it("fills the wording when the model answers nothing", async () => {
        const { service, gate } = await build()

        await service.composeAndSend(perCase, composition())

        expect(gate.submit).toHaveBeenCalledWith(expect.objectContaining({ draft: "Chao An tu Tiem Hoa" }))
    })
})
describe("AutomationMessagesService replyWithoutLead", () => {
    const reply = { conversationId: "cv-1", name: "Khach", dedupe: "after:cv-1" }
    it("sends the wording as a reply on the conversation", async () => {
        const { service, gate } = await build()

        const result = await service.replyWithoutLead(context(), reply)

        expect(gate.submit).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            actor: "actor{} · Cam on",
            action: "reply_customer",
            subject: { type: "conversation", id: "cv-1" },
            leadId: null,
            dedupeKey: "automation:p-1:after:cv-1",
            summary: 'after.summary{"name":"Khach"}',
            draft: "Chao Khach tu Tiem Hoa",
            fields: { conversation_id: "cv-1", question: "" },
            forceAsk: false,
            autoApprove: false,
        })
        expect(result).toEqual({
            status: "done",
            steps: [
                {
                    label: "step.sent{}",
                    status: "done",
                    workItemId: "w-1",
                    message: "Chao Khach tu Tiem Hoa",
                    detail: "Da gui",
                },
            ],
            evidence: "Da gui",
        })
    })

    it("has no detail when the gate gave no summary, and waits when the gate holds it", async () => {
        const { service, gate } = await build()
        gate.submit.mockResolvedValueOnce(outcome({ summary: null }))
        gate.submit.mockResolvedValueOnce(outcome({ state: "waiting" }))

        const sent = await service.replyWithoutLead(context(), reply)
        const waiting = await service.replyWithoutLead(context(), reply)

        expect(sent.steps[0]?.detail).toBeUndefined()
        expect(waiting).toMatchObject({
            status: "waiting_approval",
            steps: [{ label: "step.waiting{}", status: "waiting" }],
            evidence: "evidence.waiting{}",
        })
    })

    it("fails when the gate could not send", async () => {
        const { service, gate } = await build()
        gate.submit.mockResolvedValueOnce(outcome({ state: "failed", error: "down" }))
        gate.submit.mockResolvedValueOnce(outcome({ state: "rejected", error: null }))

        await expect(service.replyWithoutLead(context(), reply)).rejects.toMatchObject({
            code: AutomationsErrorCode.MessageNotSent,
            cause: objectLike({ message: "down" }),
        })
        await expect(service.replyWithoutLead(context(), reply)).rejects.toMatchObject({
            cause: objectLike({ message: "error.notSent{}" }),
        })
    })
})
describe("AutomationMessagesService isNegative", () => {
    it("is no for an empty feedback, yes for a keyword, and asks the model otherwise", async () => {
        const { service, text } = await build()
        text.generate.mockResolvedValueOnce("negative").mockResolvedValueOnce("POSITIVE").mockResolvedValueOnce(null)

        await expect(service.isNegative("   ", "ws-1")).resolves.toBe(false)
        await expect(service.isNegative("This was TERRIBLE", "ws-1")).resolves.toBe(true)
        await expect(service.isNegative("hmm not sure", "ws-1")).resolves.toBe(true)
        await expect(service.isNegative("great", "ws-1")).resolves.toBe(false)
        await expect(service.isNegative("fine", "ws-1")).resolves.toBe(false)

        expect(text.generate).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            purpose: "classify",
            system: textLike("POSITIVE, NEUTRAL or NEGATIVE"),
            prompt: "hmm not sure",
        })
    })

    it("is no on any doubt when the model answers nothing", async () => {
        const { service } = await build()

        await expect(service.isNegative("hmm not sure", "ws-1")).resolves.toBe(false)
    })
})
