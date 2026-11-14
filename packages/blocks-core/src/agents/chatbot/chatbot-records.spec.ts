import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { conversationEntity } from "./entities/conversation.entity"
import { chatSettingsEntity } from "./entities/settings.entity"
import { CONVERSATION_FIELDS, SETTINGS_FIELDS, settingsOf, threadRowOf } from "./chatbot-records"

// Design change (owner ruling R26, MESSAGES-PLAN section 4): the chatbot keeps no line record (`blocks-core.chatbot.message` is gone) and
// the chat keeps no tail (`lastText`, `lastRole`, `messageCount`): the words are the engine's.
// Design change (ruling R43): the chat keeps no holder (`handledBy`, `handledAt`): the staff hold is the engine's route.

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
    contactId: null,
    routeId: null,
    startedAt: "2026-11-05T00:00:00.000Z",
    status: "needs",
    waiting: true,
    unanswered: true,
    lastAt: "2026-11-05T00:00:00.000Z",
}

describe("threadRowOf", () => {
    it("reads the fields of a conversation record with its id and version", () => {
        expect(threadRowOf(recordOf(CONVERSATION))).toEqual({ id: "r1", version: "4", ...CONVERSATION })
    })

    it("reads a nullable field the engine left out as null", () => {
        const { startedAt, lastAt, ...required } = CONVERSATION
        expect([startedAt, lastAt]).toHaveLength(2)
        expect(threadRowOf(recordOf(required))).toMatchObject({
            startedAt: null,
            lastAt: null,
        })
    })

    it("answers null for fields that are not a conversation's", () => {
        expect(threadRowOf(recordOf({ ...CONVERSATION, channel: "mail" }))).toBeNull()
        expect(threadRowOf(recordOf({ ...CONVERSATION, waiting: "yes" }))).toBeNull()
        expect(threadRowOf(recordOf({}))).toBeNull()
    })
})

describe("the selected fields", () => {
    it("name declared fields of the entity, so a query selects only what exists", () => {
        expect(CONVERSATION_FIELDS.filter((name) => !(name in conversationEntity.fields))).toEqual([])
    })
})

describe("settingsOf", () => {
    it("reads the rules a settings record holds, with who saved them, nobody when it says none", () => {
        expect(settingsOf(recordOf({ holdingMessage: "Wait", updatedBy: "Lan" }))).toEqual({
            holdingMessage: "Wait",
            updatedBy: "Lan",
        })
        expect(settingsOf(recordOf({ holdingMessage: "Wait" }))?.updatedBy).toBe("")
    })

    it("answers nothing for fields that are not the rules, and selects only declared fields", () => {
        expect(settingsOf(recordOf({ holdingMessage: 7 }))).toBeNull()
        expect(SETTINGS_FIELDS.every((name) => name in chatSettingsEntity.fields)).toBe(true)
    })
})
