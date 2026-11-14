import { WAITING_ROW } from "../fixtures/chatbot.fixtures"
import { STAFF_CONTEXT, memoryProvider, memoryWorld, recordOfThread } from "../fixtures/chatbot.memory"
import { THREAD } from "./thread.read"

describe("the blocks-core.chatbot.api.chat.get read", () => {
    it("shows the conversation and the contact behind it", async () => {
        const result = await THREAD.execute?.(memoryProvider(memoryWorld()), { id: "c1" }, STAFF_CONTEXT)
        expect(result).toEqual({
            ok: true,
            data: {
                id: "c1",
                name: "Minh Anh Nguyen",
                channelName: "Zalo",
                avatarUrl: "",
                contactId: "0c0a0000-0000-4000-8000-0000000000c1",
                routeId: "0c0a0000-0000-4000-8000-0000000000a1",
                status: "needs",
                handledBy: "",
            },
        })
    })

    it("carries the picture link the channel gave the customer", async () => {
        const world = memoryWorld()
        world.conversations.push({
            ...recordOfThread({ ...WAITING_ROW, avatarUrl: "https://zalo.test/minh.png" }),
            id: "pic",
        })
        expect(await THREAD.execute?.(memoryProvider(world), { id: "pic" }, STAFF_CONTEXT)).toMatchObject({
            ok: true,
            data: { avatarUrl: "https://zalo.test/minh.png" },
        })
    })

    it("names the holder of a conversation a person holds", async () => {
        const result = await THREAD.execute?.(memoryProvider(memoryWorld()), { id: "c2" }, STAFF_CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { handledBy: "Thu Ha Le", channelName: "Telegram" } })
    })

    it("answers nothing for a conversation the workspace does not have, and an empty contact for a customer no contact holds", async () => {
        const provider = memoryProvider(memoryWorld())
        expect(await THREAD.execute?.(provider, { id: "missing" }, STAFF_CONTEXT)).toEqual({ ok: true, data: null })
        expect(await THREAD.execute?.(provider, { id: "c3" }, STAFF_CONTEXT)).toMatchObject({
            ok: true,
            data: { contactId: "", routeId: "" },
        })
    })

    it("answers nothing for a record whose fields are not a conversation's", async () => {
        const world = memoryWorld()
        world.conversations.push({ ...recordOfThread(WAITING_ROW), id: "bad", data: { name: 5 } })
        expect(await THREAD.execute?.(memoryProvider(world), { id: "bad" }, STAFF_CONTEXT)).toEqual({
            ok: true,
            data: null,
        })
    })

    it("refuses variables it does not declare", async () => {
        const result = await THREAD.execute?.(memoryProvider(memoryWorld()), { id: "c1", extra: 1 }, STAFF_CONTEXT)
        expect(result).toEqual({ ok: false, problems: [{ code: "INPUT_UNKNOWN_KEY", at: "extra" }] })
    })
})
