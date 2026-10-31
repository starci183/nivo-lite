import { Test } from "@nestjs/testing"
import { GATEWAY_CALLER } from "@tests/fixtures/builders/mcp-gateway.builder"
import { applyFields, dataKindOfTool, judgeDataRight, maskedValue } from "./data-rights.policy"
import type { DataRight, GatewayCaller } from "./mcp-gateway.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly dataKindOfTool: typeof dataKindOfTool
    readonly judgeDataRight: typeof judgeDataRight
    readonly applyFields: typeof applyFields
    readonly maskedValue: typeof maskedValue
}

const SUBJECT = Symbol("data-rights.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { dataKindOfTool, judgeDataRight, applyFields, maskedValue } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const RIGHT: DataRight = { kind: "customers", scope: "workspace", hide: ["cost"], mask: ["phone"] }
const INTERNAL: GatewayCaller = { ...GATEWAY_CALLER, conversationId: null, audience: "internal" }
const CUSTOMER: GatewayCaller = { ...GATEWAY_CALLER, audience: "customer" }

describe("data-rights.policy dataKindOfTool", () => {
    it.each([
        ["brain.facts.list", "brain"],
        ["dossier.findings.list", "customers"],
        ["drive.files.search", "documents"],
        ["sepay.transactions.debits", "payments"],
        ["zalo.send", "channels"],
        ["telegram.send", "channels"],
        ["einvoice.list", "invoices"],
        ["office.note", null],
        ["", null],
    ] as const)("reads %s as %s", async (tool, kind) => {
        const subject = await build()

        expect(subject.dataKindOfTool(tool)).toBe(kind)
    })
})

describe("data-rights.policy judgeDataRight", () => {
    it("lets a read pass untouched when no enforced graph governs the agent", async () => {
        const subject = await build()

        expect(subject.judgeDataRight(null, "dossier.findings.list", CUSTOMER)).toEqual({ kind: "open" })
    })

    it("denies a tool that reads no known kind of data, and a kind with no right, even with no rights at all", async () => {
        const subject = await build()

        expect(subject.judgeDataRight([RIGHT], "office.note", INTERNAL)).toEqual({ kind: "deny", reason: "no_kind" })
        expect(subject.judgeDataRight([RIGHT], "sepay.transactions.debits", INTERNAL)).toEqual({ kind: "deny", reason: "no_right" })
        expect(subject.judgeDataRight([], "dossier.findings.list", INTERNAL)).toEqual({ kind: "deny", reason: "no_right" })
    })

    it("gives an internal agent with no conversation the right it holds, as wide as it is", async () => {
        const subject = await build()

        expect(subject.judgeDataRight([RIGHT], "dossier.findings.list", INTERNAL)).toEqual({ kind: "narrow", right: RIGHT })
    })

    it("keeps an agent that faces outsiders to the rows of its conversation, whatever the right says", async () => {
        const subject = await build()

        expect(subject.judgeDataRight([RIGHT], "dossier.findings.list", CUSTOMER)).toEqual({
            kind: "narrow",
            right: { ...RIGHT, scope: "conversation" },
        })
        expect(subject.judgeDataRight([RIGHT], "dossier.findings.list", { ...GATEWAY_CALLER })).toMatchObject({
            right: { scope: "conversation" },
        })
    })

    it("reads nothing for an agent that faces outsiders when the call serves no conversation", async () => {
        const subject = await build()

        expect(subject.judgeDataRight([RIGHT], "dossier.findings.list", { ...CUSTOMER, conversationId: null })).toEqual({
            kind: "deny",
            reason: "no_conversation",
        })
    })
})

describe("data-rights.policy fields", () => {
    it("masks a long text by its ends, a short one entirely, a number and leaves nothing as it was", async () => {
        const subject = await build()

        expect(subject.maskedValue("0901234567")).toBe("0***67")
        expect(subject.maskedValue("0901")).toBe("***")
        expect(subject.maskedValue(901)).toBe("***")
        expect(subject.maskedValue(null)).toBeNull()
        expect(subject.maskedValue(undefined)).toBeUndefined()
    })

    it("drops the hidden fields and masks the masked ones at any depth, in lists too", async () => {
        const subject = await build()
        const answer = {
            name: "An",
            cost: 10,
            phone: "0901234567",
            orders: [{ price: 5, cost: 3, phone: "0987654321" }, "plain", null],
            nested: { cost: 1, keep: true },
        }

        expect(subject.applyFields(answer, RIGHT)).toEqual({
            name: "An",
            phone: "0***67",
            orders: [{ price: 5, phone: "0***21" }, "plain", null],
            nested: { keep: true },
        })
    })
})
