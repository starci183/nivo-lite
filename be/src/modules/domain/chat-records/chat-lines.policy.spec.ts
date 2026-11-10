import { Test } from "@nestjs/testing"
import {
    HOLDING_LINE_KEY_PREFIX,
    answersCustomer,
    customerLineOf,
    filesFieldOf,
    lineOf,
    lineRefOf,
    linesOf,
    orderFieldOf,
    replyOf,
    storedMessageOf,
    transcriptOf,
} from "./chat-lines.policy"

/** The members of the subject under test. */
interface Subject {
    readonly lineOf: typeof lineOf
    readonly linesOf: typeof linesOf
    readonly storedMessageOf: typeof storedMessageOf
    readonly customerLineOf: typeof customerLineOf
    readonly replyOf: typeof replyOf
    readonly transcriptOf: typeof transcriptOf
    readonly answersCustomer: typeof answersCustomer
    readonly lineRefOf: typeof lineRefOf
    readonly filesFieldOf: typeof filesFieldOf
    readonly orderFieldOf: typeof orderFieldOf
}

const SUBJECT = Symbol("chat-lines.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    lineOf,
                    linesOf,
                    storedMessageOf,
                    customerLineOf,
                    replyOf,
                    transcriptOf,
                    answersCustomer,
                    lineRefOf,
                    filesFieldOf,
                    orderFieldOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const record = (data: Record<string, unknown>, id = "m1") => ({
    id,
    workspaceId: "w",
    version: "3",
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
    data,
})

const user = { conversationId: "c1", role: "user", text: "hi", sentAt: "2026-11-06T03:00:00.000Z" }

describe("chat lines", () => {
    it("reads a line record and rejects fields that are not a line", async () => {
        const policy = await build()
        expect(policy.lineOf(record(user))).toMatchObject({
            id: "m1",
            version: "3",
            data: { role: "user", deliveryStatus: null },
        })
        expect(policy.lineOf(record({ role: "user" }))).toBeNull()
        expect(policy.linesOf(record({ role: "user" }))).toEqual([])
        expect(policy.linesOf(record(user))).toHaveLength(1)
    })

    it("maps a line to the stored message, the customer line and the reply", async () => {
        const policy = await build()
        const lines = policy.linesOf(record({ ...user, deliveryStatus: "sent" }))
        expect(lines.map(policy.storedMessageOf)).toEqual([
            { id: "m1", role: "user", body: "hi", deliveryStatus: "sent" },
        ])
        expect(lines.map(policy.customerLineOf)).toEqual([
            { id: "m1", body: "hi", at: new Date("2026-11-06T03:00:00.000Z") },
        ])
        expect(lines.map(policy.replyOf)).toEqual([{ id: "m1", body: "hi", sent: true }])
    })

    it("builds the transcript oldest first without system lines", async () => {
        const policy = await build()
        const lines = [
            record({ ...user, role: "agent", text: "c" }, "3"),
            record({ ...user, role: "system", text: "n" }, "2"),
            record({ ...user, text: "a" }, "1"),
        ].flatMap(policy.linesOf)
        expect(policy.transcriptOf(lines)).toEqual([
            { role: "user", body: "a" },
            { role: "agent", body: "c" },
        ])
    })
})

describe("answersCustomer", () => {
    const agent = (channelRef: string | null) =>
        lineOf(record({ conversationId: "c1", role: "agent", text: "x", sentAt: user.sentAt, channelRef }))

    it("counts every agent line as a reply but a run's honest holding line", async () => {
        const policy = await build()
        const reply = agent(policy.lineRefOf("graph-run:r1:reply"))
        const plain = agent(null)
        const holding = agent(policy.lineRefOf(`${HOLDING_LINE_KEY_PREFIX}r1`))
        expect(reply !== null && policy.answersCustomer(reply)).toBe(true)
        expect(plain !== null && policy.answersCustomer(plain)).toBe(true)
        expect(holding !== null && policy.answersCustomer(holding)).toBe(false)
    })
})

describe("the media fields of a stored line", () => {
    it("keeps the pictures in an object and an absent or empty list as null", async () => {
        const policy = await build()
        expect(policy.filesFieldOf(undefined)).toBeNull()
        expect(policy.filesFieldOf([])).toBeNull()
        expect(
            policy.filesFieldOf([{ id: "file-1", url: "https://x/1", name: "One", contentType: "image/png" }]),
        ).toEqual({ items: [{ id: "file-1", url: "https://x/1", name: "One", contentType: "image/png" }] })
    })

    it("keeps the order snapshot without the members it lacks, and no order as null", async () => {
        const policy = await build()
        const lines = [
            { name: "Pot", qty: 2, imageUrl: null },
            { name: "Basket", qty: 1, unitText: "1 d" },
        ]
        expect(policy.orderFieldOf(undefined)).toBeNull()
        expect(policy.orderFieldOf({ orderNo: "DH-1", lines, amountText: "", address: "", paid: false })).toEqual({
            orderNo: "DH-1",
            lines,
            amountText: "",
            address: "",
            paid: false,
        })
    })
})
