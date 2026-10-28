import { Test } from "@nestjs/testing"
import {
    textOf,
    numberOf,
    leadHref,
    stageOf,
    dotted,
    historyLine,
    firstText,
    renewalNoticeOf,
} from "./performer.policy"

const SUBJECT = Symbol("performer.policy")
type Subject = {
    textOf: typeof textOf
    numberOf: typeof numberOf
    leadHref: typeof leadHref
    stageOf: typeof stageOf
    dotted: typeof dotted
    historyLine: typeof historyLine
    firstText: typeof firstText
    renewalNoticeOf: typeof renewalNoticeOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    textOf,
                    numberOf,
                    leadHref,
                    stageOf,
                    dotted,
                    historyLine,
                    firstText,
                    renewalNoticeOf,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)
    return { subject }
}

describe("textOf", () => {
    it("reads a text field as itself", async () => {
        const { subject } = await buildSubject()

        expect(subject.textOf("tea")).toBe("tea")
    })

    it("reads a number field as its digits", async () => {
        const { subject } = await buildSubject()

        expect(subject.textOf(12000)).toBe("12000")
    })

    it("reads a missing field as empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.textOf(undefined)).toBe("")
    })

    it("reads a null field as empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.textOf(null)).toBe("")
    })
})

describe("numberOf", () => {
    it("reads a number field", async () => {
        const { subject } = await buildSubject()

        expect(subject.numberOf(12000)).toBe(12000)
    })

    it("reads a text field as no number", async () => {
        const { subject } = await buildSubject()

        expect(subject.numberOf("12000")).toBeNull()
    })

    it("reads a null field as no number", async () => {
        const { subject } = await buildSubject()

        expect(subject.numberOf(null)).toBeNull()
    })

    it("reads a missing field as no number", async () => {
        const { subject } = await buildSubject()

        expect(subject.numberOf(undefined)).toBeNull()
    })
})

describe("leadHref", () => {
    it("opens the lead", async () => {
        const { subject } = await buildSubject()

        expect(subject.leadHref("lead-1")).toBe("/leads/lead-1")
    })

    it("opens the chat when the customer is not a lead", async () => {
        const { subject } = await buildSubject()

        expect(subject.leadHref(null)).toBe("/chat")
    })

    it("opens the chat when no lead was named", async () => {
        const { subject } = await buildSubject()

        expect(subject.leadHref(undefined)).toBe("/chat")
    })
})

describe("stageOf", () => {
    it.each(["new", "qualified", "proposal", "won", "lost"])("keeps the stage %s", async (stage) => {
        const { subject } = await buildSubject()

        expect(subject.stageOf(stage)).toBe(stage)
    })

    it("rejects a text that is not a stage", async () => {
        const { subject } = await buildSubject()

        expect(subject.stageOf("closed")).toBeNull()
    })
})

describe("dotted", () => {
    it("joins the parts that have text", async () => {
        const { subject } = await buildSubject()

        expect(subject.dotted(["Hue", null, "", undefined, "tea"])).toBe("Hue · tea")
    })

    it("is empty when every part is empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.dotted([null, undefined, ""])).toBe("")
    })
})

describe("historyLine", () => {
    it("is the summary alone when there is no evidence", async () => {
        const { subject } = await buildSubject()

        expect(subject.historyLine("Asked for a quote", null)).toBe("Asked for a quote")
    })

    it("is the summary alone when the evidence is empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.historyLine("Asked for a quote", "")).toBe("Asked for a quote")
    })

    it("appends the first 400 characters of the evidence", async () => {
        const { subject } = await buildSubject()

        const evidence = `${"a".repeat(400)}tail`

        expect(subject.historyLine("Asked for a quote", evidence)).toBe(`Asked for a quote: ${"a".repeat(400)}`)
    })
})

describe("firstText", () => {
    it("keeps the first text that is not empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.firstText(["", "quote", "invoice"])).toBe("quote")
    })

    it("is empty when every text is empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.firstText(["", ""])).toBe("")
    })

    it("is empty when there is no text", async () => {
        const { subject } = await buildSubject()

        expect(subject.firstText([])).toBe("")
    })
})

describe("renewalNoticeOf", () => {
    const fields = {
        renewal_customer: "Lan",
        renewal_phone: "0901234567",
        renewal_plan: "Pro",
        renewal_end_date: "2026-11-30",
        renewal_amount_vnd: "990000",
        renewal_transfer_content: "INV1",
        renewal_invoice: "INV-1",
    }

    it("builds the ZNS renewal notice from the renewal fields of the proposal", async () => {
        const { subject } = await buildSubject()

        expect(subject.renewalNoticeOf(fields)).toEqual({
            kind: "renewal",
            phone: "0901234567",
            fields: {
                customerName: "Lan",
                plan: "Pro",
                endDate: "2026-11-30",
                amount: 990000,
                transferContent: "INV1",
                invoiceNumber: "INV-1",
            },
        })
        expect(subject.renewalNoticeOf({ ...fields, renewal_phone: "" })?.phone).toBeNull()
    })

    it.each([[{}], [{ ...fields, renewal_amount_vnd: "x" }], [{ ...fields, renewal_invoice: "" }]])(
        "is none for %j",
        async (partial) => {
            const { subject } = await buildSubject()

            expect(subject.renewalNoticeOf(partial)).toBeUndefined()
        },
    )
})
