import { Test } from "@nestjs/testing"
import type { ActionEntry } from "@modules/domain/decisions"
import {
    amountText,
    deciderOf,
    groupMentionOf,
    nextStepOf,
    replyEdits,
    seedOf,
    workAgentOf,
} from "./thread-work.policy"
import type { WorkAgent } from "./thread-work.contracts"

const SUBJECT = Symbol("thread-work.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { amountText, deciderOf, groupMentionOf, nextStepOf, replyEdits, seedOf, workAgentOf },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./thread-work.policy")>(SUBJECT)
}

const entry = (action: string, moduleKey: string): ActionEntry => ({
    action,
    moduleKey,
    maxMode: null,
    next: [],
    label: { vi: action, en: action },
})

const ACCOUNTING_AI: WorkAgent = { id: "agent-accounting", name: "Ke toan AI", module: "accounting", canTag: [] }
const CARE_AI: WorkAgent = { id: "agent-care", name: "AI CSKH", module: "chatbot", canTag: [] }

const LEAD = { id: "lead-thao", contact_name: "Chi Thao" }

describe("thread-work policy > who and how", () => {
    it("reads an agent row as the agent of the runtime", async () => {
        const subject = await buildSubject()

        expect(subject.workAgentOf({ id: "a1", name: "AI Sales", module: "sales", can_tag_agent_ids: ["a2"] })).toEqual(
            { id: "a1", name: "AI Sales", module: "sales", canTag: ["a2"] },
        )
    })

    it("lets the workspace owner decide as the owner and everyone else as staff", async () => {
        const subject = await buildSubject()

        expect(subject.deciderOf({ id: "m-nam", display_name: "Nam", role: "owner" })).toEqual({
            name: "Nam",
            kind: "owner",
            memberId: "m-nam",
        })
        expect(subject.deciderOf({ id: "m-minh", display_name: "Anh Minh", role: "manager" }).kind).toBe("staff")
    })

    it("tags the first room of the group, else its first role, else its first member, else nobody", async () => {
        const subject = await buildSubject()

        expect(subject.groupMentionOf({ roles: ["manager"], rooms: ["sales"], members: ["m-van"] })).toEqual({
            kind: "group",
            id: "room:sales",
        })
        expect(subject.groupMentionOf({ roles: ["manager"], rooms: [], members: ["m-van"] })).toEqual({
            kind: "group",
            id: "role:manager",
        })
        expect(subject.groupMentionOf({ roles: [], rooms: [], members: ["m-van"] })).toEqual({
            kind: "member",
            id: "m-van",
        })
        expect(subject.groupMentionOf({ roles: [], rooms: [], members: [] })).toBeNull()
    })

    it("writes an amount as a percentage, as money or as a count", async () => {
        const subject = await buildSubject()

        expect(subject.amountText(8, "percent", "vi")).toBe("8%")
        expect(subject.amountText(6_440_000, "vnd", "vi")).toContain("6.440.000")
        expect(subject.amountText(2, "count", "vi")).toBe("2")
    })
})

describe("thread-work policy > what a step starts from", () => {
    it("puts the customer, the amount in the rule's unit and the deal value into the seed", async () => {
        const subject = await buildSubject()

        expect(
            subject.seedOf(
                "Giam 8%",
                { action: "give_discount", amount: 8, amountVnd: 6_440_000, leadId: "lead-thao" },
                LEAD,
                "percent",
            ),
        ).toEqual({
            summary: "Giam 8%",
            amount_vnd: 6_440_000,
            fields: { customer: "Chi Thao", note: "Giam 8%", amount_vnd: 6_440_000, amount_percent: 8 },
        })
    })

    it("takes a VND amount as the deal value and leaves out what the member did not give", async () => {
        const subject = await buildSubject()

        expect(
            subject.seedOf(
                "Xuat hoa don",
                { action: "issue_invoice", amount: 9_000_000, amountVnd: null, leadId: "l" },
                LEAD,
                "vnd",
            ),
        ).toEqual({
            summary: "Xuat hoa don",
            amount_vnd: 9_000_000,
            fields: { customer: "Chi Thao", note: "Xuat hoa don", amount_vnd: 9_000_000 },
        })
        expect(
            subject.seedOf(
                "Nho xem",
                { action: "classify_lead", amount: null, amountVnd: null, leadId: "l" },
                LEAD,
                "count",
            ),
        ).toEqual({ summary: "Nho xem", amount_vnd: null, fields: { customer: "Chi Thao", note: "Nho xem" } })
    })
})

describe("thread-work policy > where the work goes", () => {
    it("hands the first next action to the agent it may tag that performs it", async () => {
        const subject = await buildSubject()

        expect(
            subject.nextStepOf(
                [entry("send_care", "sales"), entry("reply_customer", "chatbot")],
                [ACCOUNTING_AI, CARE_AI],
            ),
        ).toEqual({ action: "reply_customer", agent: CARE_AI })
    })

    it("ends the work when no agent it may tag performs a next action", async () => {
        const subject = await buildSubject()

        expect(subject.nextStepOf([entry("send_care", "sales")], [ACCOUNTING_AI])).toBeNull()
        expect(subject.nextStepOf([], [ACCOUNTING_AI])).toBeNull()
    })

    it("takes a member's answer as the one field the agent asked for, and nothing otherwise", async () => {
        const subject = await buildSubject()

        expect(subject.replyEdits(["tax_code"], "  0312345678 ")).toEqual({ fields: { tax_code: "0312345678" } })
        expect(subject.replyEdits(["tax_code", "amount_vnd"], "0312345678")).toEqual({})
        expect(subject.replyEdits([], "0312345678")).toEqual({})
        expect(subject.replyEdits(["tax_code"], "   ")).toEqual({})
    })
})
