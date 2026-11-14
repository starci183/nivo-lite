import { customerMessagesPort } from "@nivo-lite/agent-sdk/platform"
import { HANDLED_ROW, WAITING_ROW } from "../fixtures/chatbot.fixtures"
import { STAFF_CONTEXT, memoryProvider, memoryWorld } from "../fixtures/chatbot.memory"
import { CONTACT_THREADS } from "./contact-threads.read"

// Owner ruling R26: the chat stores no preview; the contact detail's conversations take the last line said on each chat's route from the
// ENGINE's conversation.
describe("the blocks-core.chatbot.api.chat.of-contact read", () => {
    it("lists the conversations of one contact, each with the last line said on its route", async () => {
        const world = memoryWorld()
        world.said.push({
            id: "l1",
            routeId: HANDLED_ROW.routeId ?? "",
            contactId: HANDLED_ROW.contactId ?? "",
            direction: "to_person",
            saidAt: "2026-11-04T00:45:00.000Z",
            text: "I will send the invoice this afternoon.",
            files: [],
            order: null,
            agentId: null,
            memberId: "member-staff",
            state: "delivered",
            reason: null,
            channel: "telegram",
            accountId: null,
            deliveredAt: "2026-11-04T00:45:01.000Z",
        })
        const result = await CONTACT_THREADS.execute?.(
            memoryProvider(world),
            { contactId: HANDLED_ROW.contactId ?? "" },
            STAFF_CONTEXT,
        )
        expect(result).toEqual({
            ok: true,
            data: {
                rows: [
                    {
                        id: "c2",
                        name: HANDLED_ROW.name,
                        channel: "telegram",
                        status: "handled",
                        lastText: "I will send the invoice this afternoon.",
                        lastAt: HANDLED_ROW.lastAt,
                    },
                ],
                cursor: null,
            },
        })
    })

    it("shows no words for a conversation whose route holds no line yet", async () => {
        const result = await CONTACT_THREADS.execute?.(
            memoryProvider(memoryWorld()),
            { contactId: WAITING_ROW.contactId ?? "" },
            STAFF_CONTEXT,
        )
        expect(result).toMatchObject({ ok: true, data: { rows: [{ id: "c1", lastText: "" }] } })
    })

    it("reads with the view permission over the chats and the engine's conversation", () => {
        expect(CONTACT_THREADS.permission).toBe("chatbot.view")
        expect(CONTACT_THREADS.ports).toMatchObject({ lines: customerMessagesPort })
    })
})
