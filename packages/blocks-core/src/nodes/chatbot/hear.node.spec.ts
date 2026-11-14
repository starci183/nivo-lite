import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { CHATBOT_CHAT_ENTITY } from "../../entities/chat/chatbot-entity-names"
import { addConversation, fakeChat, type FakeChat } from "../../modules/chatbot/fixtures/chat-store.memory"
import { memoryNodeContext, memoryRecordTools } from "../../modules/chatbot/fixtures/record-tools.memory"
import { answered } from "../tool-answers"
import { chatbotHearNode, type HearData, type HearNodeInput } from "./hear.node"

// chatbot.hear after owner ruling R26 (2026-11-14): the conversation is the ENGINE's (it kept every line at delivery), so this step
// stores NO line. It keeps only the chatbot's own working state: the route's live chat (found by `routeId` only; the channel key and the
// connection are gone from the chat), its `unanswered` / `lastAt` marks, and the visit window (`startedAt`, `archivedAt`) a Telegram `/start`
// moves. The spec before it pinned the line storage; every case is rewritten for this design.

const CONTACT = "44444444-4444-4444-8444-444444444444"
const ROUTE = "66666666-6666-4666-8666-666666666666"

/** A Zalo message's scope: the generic members and its data. */
const event = (data: Partial<HearData> = {}, extra: Partial<HearNodeInput> = {}): HearNodeInput => ({
    routeId: ROUTE,
    contactId: CONTACT,
    subject: { channel: "zalo", id: "u-1", name: "Lan" },
    data: { messageKey: "zalo:conn:m1", text: "How much are the roses", at: "2026-11-13T02:59:00.000Z", files: [], ...data },
    ...extra,
})

/** A queued event's scope (what the engine hands a step in `ctx.run.queue`). */
const queued = (key: string, text: string, at: string, channel = "zalo"): JsonObject => ({
    eventId: key,
    routeId: ROUTE,
    contactId: CONTACT,
    subject: { channel, id: "u-1" },
    data: { messageKey: key, text, at, files: [] },
    verb: "nivo.trigger.zalo.message.received",
    at,
})

const hear = async (chat: FakeChat, given: HearNodeInput, queue: ReadonlyArray<JsonObject> = [], thread: ReadonlyArray<JsonObject> = []) => {
    const tools = memoryRecordTools(chat)
    tools.answers.set(TOOL.conversationMessageList, answered({ notice: "", source: "nivo.conversation", asOf: "2026-11-13T03:00:00.000Z", facts: [...thread] }))
    const base = memoryNodeContext(tools)
    const context: NodeContext = { ...base, run: { ...base.run, queue } }
    const output = await chatbotHearNode.run(given, context)
    return { output, tools }
}

const chatsOf = (chat: FakeChat) => [...(chat.rows.get(CHATBOT_CHAT_ENTITY)?.values() ?? [])]
const writes = (tools: ReturnType<typeof memoryRecordTools>) => tools.calls.filter((call) => call.id === TOOL.recordCreate || call.id === TOOL.recordUpdate)

describe("chatbot.hear: the chatbot's working state on the route, no line stored", () => {
    it("the first line on a route opens its chat (channel and name from the subject, the window from the line) and marks it unanswered", async () => {
        const chat = fakeChat()
        const { output } = await hear(chat, event())
        const [only] = chatsOf(chat)
        expect(only?.data).toMatchObject({ channel: "zalo", name: "Lan", contactId: CONTACT, routeId: ROUTE, startedAt: "2026-11-13T02:59:00.000Z", unanswered: true, lastAt: "2026-11-13T02:59:00.000Z" })
        expect(output).toMatchObject({ route: "go", conversationId: only?.id, channel: "zalo", text: "How much are the roses", startedAt: "2026-11-13T02:59:00.000Z" })
    })

    it("finds the route's live chat and writes no record but its marks", async () => {
        const chat = fakeChat()
        const stored = await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE })
        const { output, tools } = await hear(chat, event())
        expect(output).toMatchObject({ route: "go", conversationId: stored.id })
        expect(chatsOf(chat)).toHaveLength(1)
        expect(writes(tools).map((call) => [call.id, call.args["patch"]])).toEqual([[TOOL.recordUpdate, { unanswered: true, lastAt: "2026-11-13T02:59:00.000Z" }]])
    })

    it("a burst: the event's line then the queued ones, in order; the activity stamp is the last line's", async () => {
        const chat = fakeChat()
        await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE })
        const { output } = await hear(chat, event(), [queued("zalo:conn:m2", "Two of them", "2026-11-13T02:59:30.000Z")])
        expect(output).toMatchObject({ route: "go", text: "How much are the roses\nTwo of them" })
        expect(output.messages.map((one) => one.text)).toEqual(["How much are the roses", "Two of them"])
        expect(chatsOf(chat)[0]?.data).toMatchObject({ lastAt: "2026-11-13T02:59:30.000Z" })
    })

    // Design moved (ruling R43): who holds the thread is the ENGINE's staff hold on the route; hear reads no holder and has no held end
    // (the engine's send door refuses every AI send to a held route with `route_held`). The case that pinned the held end is deleted.
    it("reads no holder: a line goes on to be answered (a staff hold is the engine's send door's, R43)", async () => {
        const chat = fakeChat()
        await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE })
        const { output } = await hear(chat, event())
        expect(output.route).toBe("go")
        expect(output).not.toHaveProperty("held")
    })

    it("names the contact on a chat that names none", async () => {
        const chat = fakeChat()
        await addConversation(chat, { channel: "zalo", contactId: null, routeId: ROUTE })
        await hear(chat, event())
        expect(chatsOf(chat)[0]?.data).toMatchObject({ contactId: CONTACT })
    })

    // Design change (ruling R45): a `/start` with no words is no longer a quiet end (`fresh-visit`): it reaches the front desk as a line with
    // no words and the model greets; no customer text is coded.
    it("Telegram's /start archives the route's live chat and opens the next one at the /start: the run goes on with no words, the chat waits", async () => {
        const chat = fakeChat()
        const old = await addConversation(chat, { channel: "telegram", contactId: CONTACT, routeId: ROUTE })
        const start = event({ text: "/start", at: "2026-11-13T02:58:00.000Z" }, { subject: { channel: "telegram", id: "u-1" } })
        const { output } = await hear(chat, start)
        const rows = chatsOf(chat)
        expect(rows.find((row) => row.id === old.id)?.data).toMatchObject({ archivedAt: "2026-11-13T02:58:00.000Z" })
        const next = rows.find((row) => row.id !== old.id)
        expect(next?.data).toMatchObject({ routeId: ROUTE, startedAt: "2026-11-13T02:58:00.000Z", unanswered: true, lastAt: "2026-11-13T02:58:00.000Z" })
        expect(next?.data["archivedAt"] ?? null).toBeNull()
        expect(output).toMatchObject({ route: "go", conversationId: next?.id, text: "", startedAt: "2026-11-13T02:58:00.000Z", messages: [] })
    })

    it("a line with only a picture goes on with no words and hands the picture on (ruling R45)", async () => {
        const chat = fakeChat()
        await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE })
        const picture = { id: "f-1", url: "https://files.example/rose.jpg", name: "rose.jpg", contentType: "image/jpeg" }
        const { output } = await hear(chat, event({ text: "", files: [picture] }))
        expect(output).toMatchObject({
            route: "go",
            text: "",
            messages: [{ text: "", attachments: [{ name: "rose.jpg", contentType: "image/jpeg", url: "https://files.example/rose.jpg" }] }],
        })
    })

    it("/start is Telegram's command only: the same text on Zalo is a line like any other", async () => {
        const chat = fakeChat()
        await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE })
        const { output } = await hear(chat, event({ text: "/start" }))
        expect(output).toMatchObject({ route: "go", text: "/start" })
        expect(chatsOf(chat)).toHaveLength(1)
    })

    it("a resume (the release door's event) answers the person's lines after the shop's last one, read from the chat's window by role", async () => {
        const chat = fakeChat()
        await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE, startedAt: "2026-11-13T01:00:00.000Z" })
        const thread = [
            { role: "user", text: "Still there?", at: "2026-11-13T02:50:00.000Z" },
            { role: "user", text: "Hello", at: "2026-11-13T02:40:00.000Z" },
            { role: "agent", text: "We open at 8", at: "2026-11-13T02:30:00.000Z" },
            { role: "user", text: "When do you open", at: "2026-11-13T02:20:00.000Z" },
        ]
        const { output, tools } = await hear(chat, event({ messageKey: null, text: "", at: null, resume: "held" }, { subject: null }), [], thread)
        expect(output).toMatchObject({ route: "go", text: "Hello\nStill there?" })
        expect(tools.calls.find((call) => call.id === TOOL.conversationMessageList)?.args).toMatchObject({ since: "2026-11-13T01:00:00.000Z" })
    })

    it("nothing to answer, or no route to open a chat on: the run ends, nothing written", async () => {
        const chat = fakeChat()
        const quiet = await hear(chat, event({ text: "" }))
        expect(quiet.output.route).toBe("nothing")
        const lost = fakeChat()
        const none = await hear(lost, event({ text: "" }, { routeId: null }))
        expect(none.output).toMatchObject({ route: "nothing", conversationId: "" })
        expect(chatsOf(lost)).toEqual([])
    })
})
