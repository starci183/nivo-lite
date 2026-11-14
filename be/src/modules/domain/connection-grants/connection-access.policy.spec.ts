import { Test } from "@nestjs/testing"
import type { ChannelAgent } from "@modules/domain/installed-plugins"
import {
    isDataProvider as realIsDataProvider,
    planExactly as realPlanExactly,
    purposeFor as realPurposeFor,
    purposeOfAgent as realPurposeOfAgent,
} from "./connection-access.policy"

const SUBJECT = Symbol("connection-access.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isDataProvider: realIsDataProvider,
                    planExactly: realPlanExactly,
                    purposeFor: realPurposeFor,
                    purposeOfAgent: realPurposeOfAgent,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        isDataProvider: typeof realIsDataProvider
        planExactly: typeof realPlanExactly
        purposeFor: typeof realPurposeFor
        purposeOfAgent: typeof realPurposeOfAgent
    }>(SUBJECT)
    return subject
}

describe("connection access policy", () => {
    describe("purposeFor", () => {
        it.each([
            ["chatbot", "telegram", "inbound_chat"],
            ["chatbot", "zalo_oa", "inbound_chat"],
            ["webdesk", "zalo_oa", "inbound_chat"],
            ["chatbot", "meta", "inbound_chat"],
            ["booking", "meta", "outbound_chat"],
            ["booking", "zalo_oa", "outbound_chat"],
            ["sales", "telegram", "outbound_chat"],
            ["sales", "sepay", "bank_feed"],
            ["sales", "casso", "bank_feed"],
            ["sales", "payos", "bank_feed"],
            ["chatbot", "database", "data_source"],
            ["webmail", "imap", "data_source"],
            ["sales", "openapi", "tool"],
        ])("%s on %s is %s, read from the installation", async (module, provider, purpose) => {
            const subject = await buildSubject()

            expect(subject.purposeFor(module, provider)).toBe(purpose)
        })

        it("answers null for a pair that cannot be granted", async () => {
            const subject = await buildSubject()

            expect(subject.purposeFor("booking", "sepay")).toBeNull()
            expect(subject.purposeFor("accounting", "sepay")).toBeNull()
            expect(subject.purposeFor("hiring", "zalo_oa")).toBeNull()
            expect(subject.purposeFor("loyalty", "telegram")).toBeNull()
            expect(subject.purposeFor("constructor", "x")).toBeNull()
        })

        it("reads a template agent that wakes on a customer message of the provider as its inbound agent", async () => {
            const subject = await buildSubject()
            const agent: ChannelAgent = {
                key: "front",
                accounts: ["zalo_oa", "telegram"],
                graphs: [{ spec: { triggers: [{ verb: "nivo.trigger.telegram.message.received", accounts: ["telegram"] }] } }],
            }

            expect(subject.purposeOfAgent(agent, "telegram")).toBe("inbound_chat")
            expect(subject.purposeOfAgent(agent, "zalo_oa")).toBe("outbound_chat")
            expect(subject.purposeOfAgent(agent, "sepay")).toBeNull()
            expect(subject.purposeOfAgent(null, "telegram")).toBeNull()
        })
    })

    it("tells data providers from the others", async () => {
        const subject = await buildSubject()

        expect(subject.isDataProvider("database")).toBe(true)
        expect(subject.isDataProvider("telegram")).toBe(false)
    })

    describe("planExactly", () => {
        it("binds every wanted id and removes every current id that is not wanted", async () => {
            const subject = await buildSubject()

            expect(subject.planExactly(new Set(["a", "gone"]), ["a", "new"])).toEqual([
                { id: "a", bound: true },
                { id: "new", bound: true },
                { id: "gone", bound: false },
            ])
        })

        it("removes everything when nothing is wanted", async () => {
            const subject = await buildSubject()

            expect(subject.planExactly(new Set(["a"]), [])).toEqual([{ id: "a", bound: false }])
        })
    })
})
