import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { THREAD } from "./thread.read"

describe("the chatbot.thread read", () => {
    it("shows the conversation with the facts of its customer", async () => {
        const result = await THREAD.execute?.(memoryProvider(memoryWorld()), { id: "c1" }, STAFF_CONTEXT)
        expect(result).toEqual({
            ok: true,
            data: {
                id: "c1",
                name: "Nguy\u1ec5n Minh Anh",
                channelName: "Zalo",
                status: "needs",
                handledBy: "",
                stage: "qualified",
                need: "Two flower pots",
                company: "Hoa Sen Studio",
                phone: "0901234567",
                email: "minh@example.com",
            },
        })
    })

    it("names the holder of a conversation a person holds", async () => {
        const result = await THREAD.execute?.(memoryProvider(memoryWorld()), { id: "c2" }, STAFF_CONTEXT)
        expect(result).toMatchObject({
            ok: true,
            data: { handledBy: "L\u00ea Thu H\u00e0", channelName: "Telegram", stage: "" },
        })
    })

    it("answers nothing for a conversation the workspace does not have, and for a customer not yet captured", async () => {
        const provider = memoryProvider(memoryWorld())
        expect(await THREAD.execute?.(provider, { id: "missing" }, STAFF_CONTEXT)).toEqual({ ok: true, data: null })
        expect(await THREAD.execute?.(provider, { id: "c3" }, STAFF_CONTEXT)).toMatchObject({
            ok: true,
            data: { stage: "", need: "", phone: "" },
        })
    })

    it("refuses variables it does not declare", async () => {
        const result = await THREAD.execute?.(memoryProvider(memoryWorld()), { id: "c1", extra: 1 }, STAFF_CONTEXT)
        expect(result).toEqual({ ok: false, problems: [{ code: "INPUT_UNKNOWN_KEY", at: "extra" }] })
    })
})
