import { Test } from "@nestjs/testing"
import {
    detailOf,
    findingsOf,
    humanReasonOf,
    parseJsonLoose,
    readChatApplication,
    readChatBookingRequest,
    readCustomerReply,
} from "./reply-reading.policy"
import type { CustomerReply } from "./customer-turns.contracts"
const SUBJECT = Symbol("reply-reading.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    parseJsonLoose,
                    readChatApplication,
                    readChatBookingRequest,
                    findingsOf,
                    readCustomerReply,
                    detailOf,
                    humanReasonOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./reply-reading.policy")>(SUBJECT)
}

const HOLD = "One moment."

describe("parseJsonLoose", () => {
    it("reads fenced objects after long padding and rejects a padded non-object", async () => {
        const subject = await build()
        const padding = " ".repeat(20_000)
        expect(subject.parseJsonLoose('```json\n{"a":1}' + padding + "```")).toEqual({ a: 1 })
        expect(subject.parseJsonLoose(padding + "no object")).toBeNull()
    })

    it("reads a whole object, a fenced block, and the outermost braces", async () => {
        const subject = await build()

        expect(subject.parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
        expect(subject.parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 })
        expect(subject.parseJsonLoose('```\n{"a":1}\n```')).toEqual({ a: 1 })
        expect(subject.parseJsonLoose('note {"a":1} tail')).toEqual({ a: 1 })
    })

    it.each(["", "no braces", "} before {", "{not json}", "[1,2]", "```json\n[1]\n```"])(
        "returns null for %s",
        async (raw) => {
            const subject = await build()

            expect(subject.parseJsonLoose(raw)).toBeNull()
        },
    )
})

describe("readChatApplication", () => {
    const application = {
        job: "barista",
        name: "Lan",
        phone: "0912",
        email: "",
        consent: true,
        availability: "mornings",
        answers: [{ question_id: "q1", answer: "yes" }, { question_id: "", answer: "no" }, "skip"],
    }

    it("keeps a consented application with a phone or an email", async () => {
        const subject = await build()

        expect(subject.readChatApplication(application)).toEqual({
            job: "barista",
            name: "Lan",
            phone: "0912",
            email: "",
            consent: true,
            availability: "mornings",
            answers: [{ questionId: "q1", answer: "yes" }],
        })
        expect(subject.readChatApplication({ ...application, phone: "", email: "lan@example.com" })?.email).toBe(
            "lan@example.com",
        )
    })

    it.each([
        ["not an object", null],
        ["no job", { ...application, job: " " }],
        ["no name", { ...application, name: "" }],
        ["no contact", { ...application, phone: "", email: "" }],
        ["no consent", { ...application, consent: false }],
    ])("returns null for %s", async (_label, value) => {
        const subject = await build()

        expect(subject.readChatApplication(value)).toBeNull()
    })

    it("drops answers that are not a list or that have a blank side", async () => {
        const subject = await build()

        expect(subject.readChatApplication({ ...application, answers: "yes" })?.answers).toEqual([])
        expect(
            subject.readChatApplication({
                ...application,
                answers: [
                    { question_id: "q1", answer: "" },
                    { question_id: "", answer: "yes" },
                ],
            })?.answers,
        ).toEqual([])
    })

    it("bounds the job, the name and an answer", async () => {
        const subject = await build()

        const long = subject.readChatApplication({ ...application, job: "j".repeat(200), name: "n".repeat(200) })
        expect(long?.job).toHaveLength(100)
        expect(long?.name).toHaveLength(120)
    })
})

describe("readChatBookingRequest", () => {
    it.each(["book", "reschedule", "cancel", "availability", "waitlist"] as const)(
        "keeps a %s request",
        async (intent) => {
            const subject = await build()

            expect(
                subject.readChatBookingRequest({
                    intent,
                    service: "Tea",
                    date: "2026-10-14",
                    time: "9:05",
                    from: "09:00",
                    to: "10:00",
                    party_size: 1.6,
                    contact_name: "Lan",
                    phone: "0912",
                    email: "lan@example.com",
                    note: "window",
                }),
            ).toEqual({
                intent,
                service: "Tea",
                date: "2026-10-14",
                time: "09:05",
                from: "09:00",
                to: "10:00",
                partySize: 2,
                name: "Lan",
                phone: "0912",
                email: "lan@example.com",
                note: "window",
            })
        },
    )

    it("defaults a missing party and clears an invalid date, hour and contact", async () => {
        const subject = await build()

        expect(
            subject.readChatBookingRequest({
                intent: "book",
                party_size: 0,
                date: "Tuesday",
                time: "9:5",
                from: "99:00",
                phone: " ",
                email: "",
                note: "",
            }),
        ).toEqual({
            intent: "book",
            service: "",
            date: null,
            time: null,
            from: null,
            to: null,
            partySize: 1,
            name: "",
            phone: null,
            email: null,
            note: null,
        })
    })
})

describe("readChatBookingRequest", () => {
    it("caps the party at 200 and reads a numeric string", async () => {
        const subject = await build()

        expect(subject.readChatBookingRequest({ intent: "book", party_size: 500 })?.partySize).toBe(200)
        expect(subject.readChatBookingRequest({ intent: "book", party_size: "3" })?.partySize).toBe(3)
        expect(subject.readChatBookingRequest({ intent: "book", party_size: "nope" })?.partySize).toBe(1)
        expect(subject.readChatBookingRequest({ intent: "book", date: "2026-10-14 extra" })?.date).toBe("2026-10-14")
    })

    it.each([null, [], { intent: "join" }])("returns null for %j", async (value) => {
        const subject = await build()

        expect(subject.readChatBookingRequest(value)).toBeNull()
    })
})

describe("findingsOf", () => {
    it("reads a lead, an order, a gap and a reward, and treats anything else as absent", async () => {
        const subject = await build()

        expect(
            subject.findingsOf({
                lead: { contact_name: "Lan", need: "Tea", company: "Hue", phone: "0912", email: "" },
                order: { items: "Tra sua", amount_vnd: "1.200" },
                payment_claim: true,
                knowledge_gap: { question: "Hours?", topic: "shop | hours" },
                loyalty: { intent: "redeem", reward_key: "free-tea" },
            }),
        ).toMatchObject({
            lead: { contactName: "Lan", company: "Hue", need: "Tea", phone: "0912", email: null },
            order: { items: "Tra sua", amountVnd: 1200 },
            paymentClaim: true,
            knowledgeGap: { question: "Hours?", topic: "shop | hours" },
            loyaltyRewardKey: "free-tea",
        })
    })

    it.each([
        ["a lead that is not an object", { lead: "Lan" }],
        ["a lead without a contact name", { lead: { contact_name: " ", need: "Tea" } }],
        ["a lead without a need", { lead: { contact_name: "Lan", need: "" } }],
        ["an order without items", { order: { items: "", amount_vnd: 10 } }],
        ["an order with a zero amount", { order: { items: "Tea", amount_vnd: 0 } }],
        ["an order with a word amount", { order: { items: "Tea", amount_vnd: "abc" } }],
        ["an order with a missing amount", { order: { items: "Tea" } }],
        ["an order with a non-finite amount", { order: { items: "Tea", amount_vnd: Number.POSITIVE_INFINITY } }],
        ["an order that is a list", { order: [] }],
        ["a gap without a question", { knowledge_gap: { question: " ", topic: "x" } }],
        ["a gap that is not an object", { knowledge_gap: "hours" }],
        ["a loyalty intent that is not redeem", { loyalty: { intent: "earn", reward_key: "tea" } }],
        ["a loyalty reward with no key", { loyalty: { intent: "redeem", reward_key: " " } }],
        ["a loyalty value that is not an object", { loyalty: "tea" }],
        ["a claim that is not exactly true", { payment_claim: "yes" }],
    ])("drops %s", async (_label, value) => {
        const subject = await build()

        const findings = subject.findingsOf(value)
        expect(findings.lead).toBeNull()
        expect(findings.order).toBeNull()
        expect(findings.knowledgeGap).toBeNull()
        expect(findings.loyaltyRewardKey).toBeNull()
        expect(findings.paymentClaim).toBe(false)
    })

    it("rounds a fractional order amount", async () => {
        const subject = await build()

        expect(subject.findingsOf({ order: { items: "Tea", amount_vnd: 1.6 } }).order).toEqual({
            items: "Tea",
            amountVnd: 2,
        })
    })
})

describe("readCustomerReply", () => {
    it("holds the line when the answer is not the contract or the reply is blank", async () => {
        const subject = await build()

        expect(subject.readCustomerReply("hello", HOLD)).toEqual({
            reply: HOLD,
            needsHuman: true,
            reason: "unclear_outcome",
            proposedAnswer: "hello",
            lead: null,
            order: null,
            paymentClaim: false,
            knowledgeGap: null,
            application: null,
            loyaltyRewardKey: null,
            bookingRequest: null,
        })
        expect(subject.readCustomerReply("   ", HOLD).proposedAnswer).toBeNull()
        expect(subject.readCustomerReply('{"reply":"  "}', HOLD).reply).toBe(HOLD)
        expect(subject.readCustomerReply("x".repeat(2000), HOLD).proposedAnswer).toHaveLength(1500)
    })

    it("keeps a reply and maps the reason", async () => {
        const subject = await build()

        const read = subject.readCustomerReply(
            JSON.stringify({
                reply: "Thanks",
                needs_human: true,
                reason: "over_authority",
                proposed_answer: "50k",
                lead: { contact_name: "Lan", need: "Tea" },
            }),
            HOLD,
        )
        expect(read.reply).toBe("Thanks")
        expect(read.needsHuman).toBe(true)
        expect(read.reason).toBe("over_authority")
        expect(read.proposedAnswer).toBe("50k")
        expect(read.lead?.contactName).toBe("Lan")
    })

    it.each([
        ["unclear_outcome", true, "unclear_outcome"],
        ["other", true, "unclear_outcome"],
        ["other", false, null],
        ["", false, null],
    ] as const)("reads reason %s when needs_human is %s as %s", async (reason, needsHuman, expected) => {
        const subject = await build()

        const read = subject.readCustomerReply(
            JSON.stringify({ reply: "Thanks", needs_human: needsHuman, reason }),
            HOLD,
        )
        expect(read.reason).toBe(expected)
        expect(read.needsHuman).toBe(needsHuman)
        expect(read.proposedAnswer).toBeNull()
    })
})

describe("humanReasonOf", () => {
    it.each([
        ["over_authority", false, "over_authority"],
        ["unclear_outcome", false, "unclear_outcome"],
        ["other", true, "unclear_outcome"],
        ["other", false, null],
    ] as const)("reads %s (needs human %s) as %s", async (reason, needsHuman, expected) => {
        const subject = await build()

        expect(subject.humanReasonOf(reason, needsHuman)).toBe(expected)
    })
})

describe("detailOf", () => {
    const empty: CustomerReply = {
        reply: "Thanks",
        needsHuman: false,
        reason: null,
        proposedAnswer: null,
        lead: null,
        order: null,
        paymentClaim: false,
        knowledgeGap: null,
        application: null,
        loyaltyRewardKey: null,
        bookingRequest: null,
    }

    it("writes nulls when nothing was captured", async () => {
        const subject = await build()

        expect(subject.detailOf(empty)).toEqual({
            lead: null,
            order: null,
            payment_claim: false,
            knowledge_gap: null,
            application: null,
            loyalty: null,
            booking_request: null,
        })
    })
})

describe("detailOf", () => {
    const empty: CustomerReply = {
        reply: "Thanks",
        needsHuman: false,
        reason: null,
        proposedAnswer: null,
        lead: null,
        order: null,
        paymentClaim: false,
        knowledgeGap: null,
        application: null,
        loyaltyRewardKey: null,
        bookingRequest: null,
    }

    it("writes the reply contract's own member names", async () => {
        const subject = await build()

        expect(
            subject.detailOf({
                ...empty,
                lead: { contactName: "Lan", company: "", need: "Tea", phone: null, email: null },
                order: { items: "Tea", amountVnd: 50_000 },
                paymentClaim: true,
                knowledgeGap: { question: "Hours?", topic: "" },
                application: {
                    job: "barista",
                    name: "Lan",
                    phone: "0912",
                    email: "",
                    consent: true,
                    availability: "",
                    answers: [{ questionId: "q1", answer: "yes" }],
                },
                loyaltyRewardKey: "free-tea",
                bookingRequest: {
                    intent: "book",
                    service: "Tea",
                    date: null,
                    time: null,
                    from: null,
                    to: null,
                    partySize: 1,
                    name: "Lan",
                    phone: null,
                    email: null,
                    note: null,
                },
            }),
        ).toEqual({
            lead: { contact_name: "Lan", company: "", need: "Tea", phone: null, email: null },
            order: { items: "Tea", amount_vnd: 50_000 },
            payment_claim: true,
            knowledge_gap: { question: "Hours?", topic: "" },
            application: {
                job: "barista",
                name: "Lan",
                phone: "0912",
                email: "",
                consent: true,
                availability: "",
                answers: [{ question_id: "q1", answer: "yes" }],
            },
            loyalty: { intent: "redeem", reward_key: "free-tea" },
            booking_request: {
                intent: "book",
                service: "Tea",
                date: null,
                time: null,
                from: null,
                to: null,
                party_size: 1,
                contact_name: "Lan",
                phone: null,
                email: null,
                note: null,
            },
        })
    })
})
