import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { CHATBOT_CHAT_ENTITY } from "../../../shared/entities/chatbot-entity-names"
import { addConversation, fakeChat, type FakeChat } from "../fixtures/chat-store.memory"
import { memoryNodeContext, memoryRecordTools } from "../fixtures/record-tools.memory"
import { answered } from "../../../shared/nodes/tool-answers"
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

    // QUEUE-DESIGN (1)-(5), R73: the engine may wake the run ONCE for several lines; what the run hears is the thread since the shop's last
    // line, pictures included, never only the line the wake carried.
    describe("ONE wake for several lines: what the run hears is the thread since the shop's last line", () => {
        const picture = "https://files.example/rose.jpg"
        // Newest first, as the engine's read answers: four unread lines (one a picture) after the shop's last line, an older line before it.
        const thread = [
            { role: "user", text: "Is it fresh?", at: "2026-11-13T02:59:40.000Z" },
            { role: "user", text: "", at: "2026-11-13T02:59:30.000Z", files: [{ url: picture, contentType: "image/jpeg" }] },
            { role: "user", text: "Like this one", at: "2026-11-13T02:59:20.000Z" },
            { role: "user", text: "How much are the roses", at: "2026-11-13T02:59:00.000Z" },
            { role: "agent", text: "We open at 8", at: "2026-11-13T02:30:00.000Z" },
            { role: "user", text: "When do you open", at: "2026-11-13T02:20:00.000Z" },
        ]

        it("the wake carries the oldest line only: the four unread lines are heard together, in order, the picture handed on", async () => {
            const chat = fakeChat()
            await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE, startedAt: "2026-11-13T01:00:00.000Z" })
            const { output, tools } = await hear(chat, event(), [], thread)
            expect(output).toMatchObject({ route: "go", text: "How much are the roses\nLike this one\nIs it fresh?" })
            expect(output.messages).toEqual([
                { text: "How much are the roses", attachments: [] },
                { text: "Like this one", attachments: [] },
                { text: "", attachments: [{ name: "", contentType: "image/jpeg", url: picture }] },
                { text: "Is it fresh?", attachments: [] },
            ])
            expect(tools.calls.filter((call) => call.id === TOOL.conversationMessageList)).toHaveLength(1)
            expect(tools.calls.find((call) => call.id === TOOL.conversationMessageList)?.args).toMatchObject({ since: "2026-11-13T01:00:00.000Z" })
        })

        it("a resume hears the same four lines WITH the picture (its path dropped pictures before)", async () => {
            const chat = fakeChat()
            await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE, startedAt: "2026-11-13T01:00:00.000Z" })
            const { output } = await hear(chat, event({ messageKey: null, text: "", at: null, resume: "held" }, { subject: null }), [], thread)
            expect(output.route).toBe("go")
            expect(output.messages).toHaveLength(4)
            expect(output.messages[2]).toEqual({ text: "", attachments: [{ name: "", contentType: "image/jpeg", url: picture }] })
        })

        it("a resume after a picture-only line goes on: a picture is something to answer", async () => {
            const chat = fakeChat()
            await addConversation(chat, { channel: "zalo", contactId: CONTACT, routeId: ROUTE })
            const only = [thread[1] ?? {}, thread[4] ?? {}]
            const { output } = await hear(chat, event({ messageKey: null, text: "", at: null, resume: "held" }, { subject: null }), [], only)
            expect(output).toMatchObject({ route: "go", text: "" })
            expect(output.messages).toHaveLength(1)
        })

        it("Telegram: lines up to the last /start belong to the archived visit; only what follows it is heard", async () => {
            const chat = fakeChat()
            await addConversation(chat, { channel: "telegram", contactId: CONTACT, routeId: ROUTE })
            const visit = [
                { role: "user", text: "roses please", at: "2026-11-13T02:59:10.000Z" },
                { role: "user", text: "/start", at: "2026-11-13T02:59:00.000Z" },
                { role: "user", text: "old words", at: "2026-11-13T02:40:00.000Z" },
            ]
            const line = event({ text: "roses please", at: "2026-11-13T02:59:10.000Z" }, { subject: { channel: "telegram", id: "u-1" } })
            const { output } = await hear(chat, line, [], visit)
            expect(output).toMatchObject({ route: "go", text: "roses please" })
        })
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
