import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { conversationDataSchema, messageDataSchema } from "./chat-records.schema"

/** The members of the subject under test. */
interface Subject {
    readonly conversationDataSchema: typeof conversationDataSchema
    readonly messageDataSchema: typeof messageDataSchema
}

const SUBJECT = Symbol("chat-records.schema")

/** The schemas, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ conversationDataSchema, messageDataSchema }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const conversation = {
    channel: "zalo",
    name: "An",
    waiting: false,
    lastText: "hi",
    messageCount: 1,
}

const message = { conversationId: "c1", role: "user", text: "hi", sentAt: "2026-11-06T03:00:00.000Z" }

describe("conversationDataSchema", () => {
    it("reads every absent nullable key as null", async () => {
        const schema = (await build()).conversationDataSchema
        expect(schema.parse(conversation)).toEqual({
            ...conversation,
            connectionId: null,
            externalId: null,
            handledBy: null,
            lastRole: null,
            lastAt: null,
            agentId: null,
            frontAgentId: null,
            connectorPartyId: null,
            connectorPartyName: null,
        })
    })

    it("keeps the values present", async () => {
        const schema = (await build()).conversationDataSchema
        const full = { ...conversation, connectionId: "k1", handledBy: "Lan", lastRole: "agent", agentId: "a1" }
        expect(schema.parse(full)).toMatchObject({
            connectionId: "k1",
            handledBy: "Lan",
            lastRole: "agent",
            agentId: "a1",
        })
    })

    it("refuses a field of the wrong type or past its bound", async () => {
        const schema = (await build()).conversationDataSchema
        expect(schema.safeParse({ ...conversation, waiting: "no" }).success).toBe(false)
        expect(schema.safeParse({ ...conversation, name: "x".repeat(501) }).success).toBe(false)
    })
})

describe("messageDataSchema", () => {
    it("reads an absent delivery state and channel key as null and keeps the present ones", async () => {
        const schema = (await build()).messageDataSchema
        expect(schema.parse(message)).toEqual({
            ...message,
            deliveryStatus: null,
            deliveryError: null,
            channelRef: null,
        })
        expect(schema.parse({ ...message, deliveryStatus: "sent", channelRef: "line:k" })).toMatchObject({
            deliveryStatus: "sent",
            channelRef: "line:k",
        })
    })

    it("refuses a role it does not know", async () => {
        const schema = (await build()).messageDataSchema
        expect(schema.safeParse({ ...message, role: "bot" }).success).toBe(false)
    })
})
