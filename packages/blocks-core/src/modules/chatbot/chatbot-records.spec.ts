import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { conversationEntity } from "../../entities/chat/conversation.entity"
import { messageEntity } from "../../entities/chat/message.entity"
import { settingsEntity } from "../../entities/chat/settings.entity"
import { leadEntity } from "../../entities/sales/lead.entity"
import {
    CONVERSATION_FIELDS,
    LEAD_FIELDS,
    MESSAGE_FIELDS,
    leadFactsOf,
    SETTINGS_FIELDS,
    messageRecordOf,
    settingsOf,
    threadRowOf,
} from "./chatbot-records"

const recordOf = (data: Readonly<Record<string, unknown>>): RecordRow => ({
    id: "r1",
    workspaceId: "w1",
    version: "4",
    createdAt: "2026-11-05T00:00:00.000Z",
    updatedAt: "2026-11-05T00:00:00.000Z",
    data,
})

const CONVERSATION = {
    name: "Minh Anh",
    channel: "zalo",
    externalId: "849",
    status: "needs",
    waiting: true,
    unanswered: true,
    handledBy: null,
    handledAt: null,
    lastText: "Hello",
    lastRole: "user",
    lastAt: "2026-11-05T00:00:00.000Z",
    messageCount: 3,
}

const LINE = {
    conversationId: "c1",
    role: "agent",
    text: "Hi",
    sentAt: "2026-11-05T00:00:00.000Z",
    authorKind: "human",
    authorName: "Ha",
    authorUserId: "m1",
    status: "posted",
    deliveryStatus: "sent",
    deliveryError: null,
}

describe("threadRowOf", () => {
    it("reads the fields of a conversation record with its id and version", () => {
        expect(threadRowOf(recordOf(CONVERSATION))).toEqual({ id: "r1", version: "4", ...CONVERSATION })
    })

    it("reads a nullable field the engine left out as null", () => {
        const { externalId, handledBy, handledAt, lastRole, lastAt, ...required } = CONVERSATION
        expect([externalId, handledBy, handledAt, lastRole, lastAt]).toHaveLength(5)
        expect(threadRowOf(recordOf(required))).toMatchObject({
            externalId: null,
            handledBy: null,
            handledAt: null,
            lastRole: null,
            lastAt: null,
        })
    })

    it("answers null for fields that are not a conversation's", () => {
        expect(threadRowOf(recordOf({ ...CONVERSATION, channel: "mail" }))).toBeNull()
        expect(threadRowOf(recordOf({ ...CONVERSATION, messageCount: -1 }))).toBeNull()
        expect(threadRowOf(recordOf({}))).toBeNull()
    })
})

describe("messageRecordOf", () => {
    it("reads the fields of a line record with its id and version", () => {
        expect(messageRecordOf(recordOf(LINE))).toEqual({ id: "r1", version: "4", ...LINE })
    })

    it("reads a nullable field the engine left out as null", () => {
        const { authorKind, authorName, authorUserId, deliveryStatus, deliveryError, ...required } = LINE
        expect([authorKind, authorName, authorUserId, deliveryStatus, deliveryError]).toHaveLength(5)
        const { status, ...withoutStatus } = required
        expect(status).toBe("posted")
        expect(messageRecordOf(recordOf(withoutStatus))).toMatchObject({
            status: "posted",
            authorKind: null,
            authorName: null,
            authorUserId: null,
            deliveryStatus: null,
            deliveryError: null,
        })
    })

    it("answers null for fields that are not a line's", () => {
        expect(messageRecordOf(recordOf({ ...LINE, role: "robot" }))).toBeNull()
    })
})

describe("leadFactsOf", () => {
    const joined = { id: "l1", data: { contactName: "Minh Anh", stage: "new", company: "Lotus" } }

    it("reads the facts of a joined customer, the missing ones as null", () => {
        expect(leadFactsOf(joined)).toEqual({
            contactName: "Minh Anh",
            stage: "new",
            company: "Lotus",
            need: null,
            phone: null,
            email: null,
        })
    })

    it("answers null when there is no link or the fields are not a customer's", () => {
        expect(leadFactsOf(null)).toBeNull()
        expect(leadFactsOf({ id: "l1", data: { contactName: 5 } })).toBeNull()
    })
})

describe("the selected fields", () => {
    it("name declared fields of the entities, so a query selects only what exists", () => {
        expect(CONVERSATION_FIELDS.filter((name) => !(name in conversationEntity.fields))).toEqual([])
        expect(MESSAGE_FIELDS.filter((name) => !(name in messageEntity.fields))).toEqual([])
        expect(LEAD_FIELDS.filter((name) => !(name in leadEntity.fields))).toEqual([])
    })
})

describe("settingsOf", () => {
    it("reads the rules a settings record holds, with who saved them, nobody when it says none", () => {
        expect(settingsOf(recordOf({ openclawTimeoutSec: 40, holdingMessage: "Wait", updatedBy: "Lan" }))).toEqual({
            openclawTimeoutSec: 40,
            holdingMessage: "Wait",
            updatedBy: "Lan",
        })
        expect(settingsOf(recordOf({ openclawTimeoutSec: 25, holdingMessage: "Wait" }))?.updatedBy).toBe("")
    })

    it("answers nothing for fields that are not the rules, and selects only declared fields", () => {
        expect(settingsOf(recordOf({ openclawTimeoutSec: "soon", holdingMessage: "Wait" }))).toBeNull()
        expect(SETTINGS_FIELDS.every((name) => name in settingsEntity.fields)).toBe(true)
    })
})
