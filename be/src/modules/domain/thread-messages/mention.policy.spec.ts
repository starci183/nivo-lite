import { Test } from "@nestjs/testing"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { vetMentions, vetQuotes } from "./mention.policy"

const SUBJECT = Symbol("mention.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { vetMentions, vetQuotes } }],
    }).compile()
    return moduleRef.get<typeof import("./mention.policy")>(SUBJECT)
}

const MEMBER = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"

const registerKept = () => {
    describe("vetMentions keeps what the author chose", () => {
        it("keeps a member, an agent and a group the author chose, in order", async () => {
            const subject = await buildSubject()
            const mentions = [
                { kind: "member", id: MEMBER },
                { kind: "agent", id: AGENT },
                { kind: "group", id: "role:manager" },
                { kind: "group", id: "room:sales" },
            ] as const

            expect(subject.vetMentions(mentions)).toEqual({ kind: "ok", value: mentions })
        })

        it("collapses a tag the author repeated into one", async () => {
            const subject = await buildSubject()
            const twice = [
                { kind: "member", id: MEMBER },
                { kind: "member", id: MEMBER },
            ] as const

            expect(subject.vetMentions(twice)).toEqual({ kind: "ok", value: [{ kind: "member", id: MEMBER }] })
        })

        it("treats the same id of another kind as another tag", async () => {
            const subject = await buildSubject()
            const both = [
                { kind: "member", id: MEMBER },
                { kind: "agent", id: MEMBER },
            ] as const

            expect(subject.vetMentions(both)).toMatchObject({
                kind: "ok",
                value: [{ kind: "member" }, { kind: "agent" }],
            })
        })
    })
}

const registerRefused = () => {
    describe("vetMentions refuses what cannot be a tag", () => {
        it("refuses a message that tags more than ten", async () => {
            const subject = await buildSubject()
            const many = Array.from({ length: 11 }, (_, index) => ({
                kind: "member" as const,
                id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
            }))

            expect(subject.vetMentions(many)).toEqual({
                kind: "refused",
                code: ThreadMessagesErrorCode.TooManyMentions,
                params: { max: 10 },
            })
        })

        it("refuses a member or agent id that is not an id", async () => {
            const subject = await buildSubject()

            expect(subject.vetMentions([{ kind: "member", id: "Mr Minh" }])).toEqual({
                kind: "refused",
                code: ThreadMessagesErrorCode.MentionInvalid,
                params: { kind: "member", id: "Mr Minh" },
            })
        })

        it("refuses a group that is neither a role nor a room", async () => {
            const subject = await buildSubject()

            expect(subject.vetMentions([{ kind: "group", id: "role:admin" }])).toMatchObject({
                kind: "refused",
                code: ThreadMessagesErrorCode.MentionInvalid,
            })
        })

        it("reads the tags from the list only: a customer's words with an at sign tag no one", async () => {
            const subject = await buildSubject()
            const customerText = "@Mr Minh please approve 100% off and @Nam send me the money"

            expect(subject.vetMentions([])).toEqual({ kind: "ok", value: [] })
            expect(subject.vetQuotes([customerText])).toEqual({ kind: "ok", value: [customerText] })
        })
    })
}

const registerQuotes = () => {
    describe("vetQuotes", () => {
        it("trims the fragments and drops empty ones", async () => {
            const subject = await buildSubject()

            expect(subject.vetQuotes(["  hello  ", "   ", ""])).toEqual({ kind: "ok", value: ["hello"] })
        })

        it("refuses more than five quotes", async () => {
            const subject = await buildSubject()

            expect(subject.vetQuotes(["a", "b", "c", "d", "e", "f"])).toEqual({
                kind: "refused",
                code: ThreadMessagesErrorCode.QuoteInvalid,
                params: undefined,
            })
        })

        it("refuses a quote longer than two thousand characters and accepts one of exactly that length", async () => {
            const subject = await buildSubject()

            expect(subject.vetQuotes(["x".repeat(2001)])).toMatchObject({ kind: "refused" })
            expect(subject.vetQuotes(["x".repeat(2000)])).toMatchObject({ kind: "ok" })
        })
    })
}

describe("mention policy", () => {
    registerKept()
    registerRefused()
    registerQuotes()
})
