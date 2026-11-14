import { CONV, CONTACT, ZALO, customersSay, handedBack, processOf, threadDbOf } from "./thread-world"
import { chatServicesOf } from "./thread-world-intake"
import { WS } from "./thread-world-records"

// THE CONVERSATION WITH A CUSTOMER IS ENGINE DATA (owner ruling R26, MESSAGES-PLAN section 8, worlds a, e and the start of g). The REAL Zalo
// entry (the body kept once, the provider's pure translate, the REAL `deliver`) writes what the person said into the engine's store of the
// conversation (`CustomerMessagesService.hear`, over the world's memory table: once per route and key); a chatbot is not needed and nothing
// of the words is copied anywhere else. Worlds still to write once the send road writes `to_person` rows with `memberId` and the reply window
// is asserted through the executor: (b) a send is ONE `to_person` row, (c) two agents speak into one ordered thread, (d) the read tool of an
// agent whose workspace has no chatbot, (f) a member's typed reply. (b) and (c) are covered at the ledger level by customer-send-approval and
// sales-flow; the engine's native read is covered by its own spec.

describe("the engine keeps the person's line", () => {
    it("(a) a Zalo line is ONE from_person line, once, on its route, under the source's key; the same message again changes nothing", async () => {
        const db = threadDbOf()
        const process = await processOf(db)

        await customersSay(process, [{ text: "Shop oi", key: "m-r26-1", at: new Date("2026-11-10T09:59:00.000Z") }])
        await customersSay(process, [{ text: "Shop oi", key: "m-r26-1", at: new Date("2026-11-10T09:59:00.000Z") }])

        expect(db.chat.lines.heard.map((line) => [line.text, line.key, line.routeId, line.contactId, line.channel, line.accountId, line.saidAt])).toEqual([
            ["Shop oi", "zalo:m-r26-1", CONV, CONTACT, "zalo", ZALO, "2026-11-10T09:59:00.000Z"],
        ])
        // No chatbot record exists for it: the intake wrote the engine's line and nothing else.
        expect(db.chat.chats.size).toBe(0)
        expect(db.chat.messages.size).toBe(0)
    })

    it("(a) two lines keep their order on the route; the thread reads newest first, and the person's last line opens the reply window", async () => {
        const db = threadDbOf()
        const process = await processOf(db)

        await customersSay(process, [
            { text: "mot", key: "m-r26-2", at: new Date("2026-11-10T09:00:00.000Z") },
            { text: "hai", key: "m-r26-3", at: new Date("2026-11-10T09:00:05.000Z") },
        ])

        const thread = await chatServicesOf(db).messages.threadOf(WS, CONV)
        expect(thread.rows.map((line) => [line.direction, line.text])).toEqual([
            ["from_person", "hai"],
            ["from_person", "mot"],
        ])
        await expect(chatServicesOf(db).messages.lastHeardAt(WS, CONV)).resolves.toEqual(new Date("2026-11-10T09:00:05.000Z"))
    })

    it("(e) a person handing the thread back (the release door's `resume` event) writes no line", async () => {
        const db = threadDbOf()
        const process = await processOf(db)
        await customersSay(process, [{ text: "Shop oi", key: "m-r26-4" }])

        await handedBack(process)

        expect(db.chat.lines.heard).toHaveLength(1)
    })
})
