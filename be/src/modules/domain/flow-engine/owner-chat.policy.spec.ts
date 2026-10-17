import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { WorkItem } from "@modules/domain/decisions"
import type { WaitingView } from "./flow-engine.contracts"
import {
    amountOf,
    fold,
    hasWord,
    isAddressed,
    matchWaiting,
    namesOtherHandle,
    parseVnd,
    refOf,
    verdictOf,
    waitingCustomerOf,
    withoutAddress,
} from "./owner-chat.policy"

const SUBJECT = Symbol("owner-chat.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    fold,
                    hasWord,
                    isAddressed,
                    withoutAddress,
                    namesOtherHandle,
                    verdictOf,
                    parseVnd,
                    waitingCustomerOf,
                    refOf,
                    amountOf,
                    matchWaiting,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./owner-chat.policy")>(SUBJECT)
}

const registerTextAndVerdicts = () => {
    it("folds Vietnamese spelling and spacing before checking whole, escaped words", async () => {
        const subject = await buildSubject()

        expect(subject.fold("  \u0110\u1ed2NG  \u00dd\n Ch\u1ecb Lan ")).toBe("dong y chi lan")
        expect(subject.hasWord("don cua anh minh", "minh")).toBe(true)
        expect(subject.hasWord("minhanh", "minh")).toBe(false)
        expect(subject.hasWord("a", "a")).toBe(false)
        expect(subject.hasWord("accept (a+b) now", "a+b")).toBe(true)
    })

    it("recognises and strips every NIVO address and detects other handles", async () => {
        const subject = await buildSubject()

        expect(subject.isAddressed("please @NiVo: ok")).toBe(true)
        expect(subject.isAddressed("@nivobot ok")).toBe(false)
        expect(subject.withoutAddress(" @NIVO: ok @nivo, ")).toBe("ok")
        expect(subject.withoutAddress("ordinary message")).toBe("ordinary message")
        expect(subject.namesOtherHandle("ask @sales-1")).toBe(true)
        expect(subject.namesOtherHandle("ordinary message")).toBe(false)
    })

    it.each([
        ["T\u1eeb ch\u1ed1i", false, "rejected"],
        ["no thanks", true, "rejected"],
        ["\u0110\u1ed3ng \u00fd", false, "approved"],
        ["approve", true, "approved"],
        ["ok", true, "approved"],
        ["ok", false, null],
        ["update the limit", true, null],
    ])("reads the verdict in %s when addressed=%s", async (text, addressed, expected) => {
        const subject = await buildSubject()

        expect(subject.verdictOf(text, addressed)).toBe(expected)
    })

    it.each([
        ["45 tri\u1ec7u", 45_000_000],
        ["3,5 trieu", 3_500_000],
        ["2.75m", 2_750_000],
        ["45.000.000", 45_000_000],
        ["3,000,000 vnd", 3_000_000],
        ["3000000 vnd", 3_000_000],
        ["no amount 123", null],
    ])("parses VND from %s", async (text, expected) => {
        const subject = await buildSubject()

        expect(subject.parseVnd(text)).toBe(expected)
    })

    it("prefers a lead name, then customer and payer strings, and trims the result", async () => {
        const subject = await buildSubject()

        const item = itemOf({ proposal: { summary: "", fields: { customer: " Customer ", payer: " Payer " } } })
        expect(subject.waitingCustomerOf(item, " Lead ")).toBe("Lead")
        expect(subject.waitingCustomerOf(item, "")).toBe("Customer")
        expect(
            subject.waitingCustomerOf(
                itemOf({ proposal: { summary: "", fields: { customer: 4, payer: " Payer " } } }),
                "",
            ),
        ).toBe("Payer")
        expect(subject.waitingCustomerOf(itemOf({ proposal: { summary: "", fields: {} } }), "")).toBe("")
    })

    it("finds the first usable reference or returns blank", async () => {
        const subject = await buildSubject()

        expect(subject.refOf(itemOf())).toBe("FB-1234")
        expect(
            subject.refOf(
                itemOf({
                    proposal: { summary: "", fields: { order_no: " x ", reference: " REF ", invoice_no: "INV" } },
                }),
            ),
        ).toBe("REF")
        expect(subject.refOf(itemOf({ proposal: { summary: "", fields: { invoice_no: " INV " } } }))).toBe("INV")
        expect(subject.refOf(itemOf({ proposal: { summary: "", fields: { order_no: 123 } } }))).toBe("")
    })
}

const registerProposalValues = () => {
    it("uses only finite numeric proposal amounts, including the field fallback", async () => {
        const subject = await buildSubject()
        expect(subject.amountOf(itemOf())).toBe(5_000_000)
        expect(subject.amountOf(itemOf({ proposal: { summary: "", amount_vnd: 0, fields: { amount_vnd: 9 } } }))).toBe(
            0,
        )
        expect(subject.amountOf(itemOf({ proposal: { summary: "", fields: { amount_vnd: 9 } } }))).toBe(9)
        expect(subject.amountOf(itemOf({ proposal: { summary: "", fields: { amount_vnd: "9" } } }))).toBeNull()
        expect(subject.amountOf(itemOf({ proposal: { summary: "", amount_vnd: Number.NaN, fields: {} } }))).toBeNull()
    })

    it("keeps all items when there is no identifying clue", async () => {
        const subject = await buildSubject()

        const waiting = [viewOf(), viewOf({ item: itemOf({ id: "blank" }), customer: "" })]
        expect(subject.matchWaiting("ok", waiting)).toEqual({ pool: waiting, amount: null, clues: false })
        expect(subject.matchWaiting("", [])).toEqual({ pool: [], amount: null, clues: false })
    })

    it("matches names with or without honorifics and excludes a shorter overlapping name", async () => {
        const subject = await buildSubject()

        const waiting = [
            viewOf(),
            viewOf({ item: itemOf({ id: "long" }), customer: "Minh Anh" }),
            viewOf({ item: itemOf({ id: "same" }) }),
            viewOf({ item: itemOf({ id: "lan" }), customer: "Chi Lan" }),
        ]
        expect(idsOf(subject, "duyet anh minh", waiting)).toEqual(["item-1", "same"])
        expect(idsOf(subject, "duyet minh anh", waiting)).toEqual(["long"])
        expect(idsOf(subject, "duyet chi lan", waiting)).toEqual(["lan"])
        expect(idsOf(subject, "duyet minh va lan", waiting)).toEqual(["item-1", "same", "lan"])
    })

    it("treats every named person as a hard filter", async () => {
        const subject = await buildSubject()

        const waiting = [viewOf(), viewOf({ item: itemOf({ id: "lan" }), customer: "Chi Lan" })]
        expect(subject.matchWaiting("duyet chi Hung", waiting)).toEqual({ pool: [], amount: null, clues: true })
        expect(idsOf(subject, "duyet Minh", waiting)).toEqual(["item-1"])
        expect(idsOf(subject, "duyet Minh va Lan", waiting)).toEqual([])
        expect(subject.matchWaiting("duyet anh a va chi nay va ba co", waiting)).toEqual({
            pool: waiting,
            amount: null,
            clues: false,
        })
    })

    it("does not mistake sentence starts, numbers, honorifics and reserved words for names", async () => {
        const subject = await buildSubject()

        const waiting = [viewOf()]
        expect(subject.matchWaiting("Duyet. Okay! Anh Minh: Thanh toan? Invoice 123 A NIVO Anh The", waiting)).toEqual({
            pool: [],
            amount: null,
            clues: true,
        })
        expect(subject.matchWaiting("Duyet. Okay! Approve 123 A NIVO Anh The", waiting)).toEqual({
            pool: waiting,
            amount: null,
            clues: false,
        })
    })

    it("normalises numeric references without treating their digits as money", async () => {
        const subject = await buildSubject()

        const waiting = [viewOf(), viewOf({ item: itemOf({ id: "other" }), ref: "INV-202609-0001" })]
        expect(subject.matchWaiting("duyet fb1234", waiting)).toEqual({ pool: [waiting[0]], amount: null, clues: true })
        expect(idsOf(subject, "duyet INV-202609-0001", waiting)).toEqual(["other"])
        expect(subject.matchWaiting("duyet DH99999", waiting)).toEqual({ pool: [], amount: null, clues: true })
        expect(idsOf(subject, "duyet bank abc", [viewOf({ ref: "bank abc" })])).toEqual(["item-1"])
        expect(idsOf(subject, "duyet", [viewOf({ ref: "" })])).toEqual(["item-1"])
    })
}

const registerAmountMatching = () => {
    it("matches exact money and only fills a missing amount on identified or sole work", async () => {
        const subject = await buildSubject()

        const known = viewOf()
        const missing = viewOf({
            item: itemOf({ id: "missing", missing_fields: ["amount_vnd"] }),
            customer: "Lan",
            ref: "",
            amount: null,
        })
        expect(subject.matchWaiting("duyet 5 trieu", [known, missing])).toEqual({
            pool: [known],
            amount: 5_000_000,
            clues: true,
        })
        expect(idsOf(subject, "duyet 7 trieu", [known, missing])).toEqual([])
        expect(idsOf(subject, "duyet lan 7 trieu", [known, missing])).toEqual(["missing"])
        expect(idsOf(subject, "duyet 7 trieu", [missing])).toEqual(["missing"])
        expect(idsOf(subject, "duyet 7 trieu", [known])).toEqual([])
    })

    it.each([
        ["duyet hoa don", "issue_invoice"],
        ["duyet thanh toan", "reconcile_payment"],
        ["duyet bao gia", "send_quote"],
        ["duyet don", "confirm_order"],
        ["duyet follow", "send_follow_up"],
        ["duyet tra loi", "reply_customer"],
        ["duyet cham soc", "send_care"],
        ["duyet phan loai", "classify_lead"],
    ])("filters the named action %s", async (text, action) => {
        const subject = await buildSubject()

        const target = viewOf({ item: itemOf({ id: "target", action }) })
        const other = viewOf({ item: itemOf({ id: "other", action: "another_action" }) })
        expect(subject.matchWaiting(text, [target, other])).toEqual({ pool: [target], amount: null, clues: true })
    })
}

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "confirm_order",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Confirm", amount_vnd: 5_000_000, fields: { order_no: "FB-1234" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const viewOf = builder<WaitingView>({ item: itemOf(), customer: "Anh Minh", ref: "FB-1234", amount: 5_000_000 })

const idsOf = (
    subject: typeof import("./owner-chat.policy"),
    text: string,
    waiting: ReadonlyArray<WaitingView>,
): ReadonlyArray<string> => subject.matchWaiting(text, waiting).pool.map((view) => view.item.id)

describe("owner chat policy", () => {
    registerTextAndVerdicts()
    registerProposalValues()
    registerAmountMatching()
})
