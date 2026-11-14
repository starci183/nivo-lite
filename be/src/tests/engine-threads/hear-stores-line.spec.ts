import { TOOL } from "@nivo-lite/agent-sdk/names"
import { AGENT_RUNS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { CHATBOT_CHAT } from "./thread-world-chat"
import { chatServicesOf } from "./thread-world-intake"
import { WS } from "./thread-world-records"
import { ANSWER, CONTACT, CONV, FRONT, UNDERSTAND, ZALO, customersSay, processOf, runHeard, threadDbOf, type ThreadProcess } from "./thread-world"

// WORLD A: "hear stores the customer line in a run" (decoupling lane, coordinator order). After the chat flip the engine's intake keeps NO
// chatbot record: a customer line comes in through the REAL channel intake (contact met, route made sure of, the raw `zalo_oa.message` row
// kept, the front door woken with ids), and the run's FIRST step, `chatbot.hear` of the shipped front desk (the real node of blocks-core
// through the real door), stores the line once, under the message key, in the chatbot agent's own scope, in a chat that carries the wake's
// route. The reply leaves through the real send: claimed once in the delivery ledger, addressed to the person, and the chatbot's own
// `sayToCustomer` writes its outgoing line carrying the send key. The world reads the chatbot's records through the record tools' memory
// store (`thread-world-chat.ts`, the type names as the other worlds write them) and sees WHO wrote each through `chat.calls`.

const LINE = "Shop mo cua may gio?"
const REPLY = "Shop mo cua tu 8h den 21h a."

/** The model's answers of the question route: the understand step routes to `answer`, whose agent searches once and answers. */
const scriptQuestion = (db: ReturnType<typeof threadDbOf>): void => {
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } }, { done: { reply: REPLY } })
}

/** The steps a run walked, in order. */
const stepsOf = async (process: ThreadProcess, runId: string): Promise<ReadonlyArray<string>> => {
    const view = await process.threads.stateOf({
        workspaceId: process.db.records.get(AGENT_RUNS, runId)?.workspaceId ?? "",
        runId,
    })
    return Object.keys(view?.state.steps ?? {})
}

describe("hear stores the customer line in a run (the chat flow, after the flip)", () => {
    it("the intake writes no chatbot record; the engine keeps the line once; the run's first step opens the chat only; the reply is a delivered ledger row", async () => {
        const db = threadDbOf()
        scriptQuestion(db)
        const process = await processOf(db)

        // THE INTAKE: the same road the Zalo adapter takes.
        const wakes = await customersSay(process, [{ text: LINE, key: "m-hear-1" }])

        expect(wakes).toHaveLength(1)
        const [wake] = wakes
        // The wake carries ids only (the event pipeline): the verb, the event, the registration that took it, the account, the person, the
        // route (the engine's `conversationId`) and the raw row its data is rebuilt from; no words, no channel, no front door.
        expect(wake?.source).toBe("trigger")
        expect(wake?.context).toMatchObject({
            verb: "nivo.trigger.zalo.message.received",
            eventId: "m-hear-1",
            declaration: "zalo_oa:message.received",
            connectionId: ZALO,
            contactId: CONTACT,
            conversationId: CONV,
            rawType: "zalo_oa.event",
        })
        expect(wake?.context).not.toHaveProperty("messageKey")
        expect(wake?.scopeKey).toBe(`key:routeId=${CONV}`)
        // The raw row is the engine's only record of the words (the body Zalo posted, kept once); the route is the person's entrance.
        expect(db.chat.raw.map((row) => [row.type, row.key, (row.value.raw as { message: { text: string } }).message.text])).toEqual([
            ["zalo_oa.event", "m-hear-1", LINE],
        ])
        expect(db.chat.routes.rows.map((row) => [row.id, row.contactId, row.channel, row.accountId])).toEqual([[CONV, CONTACT, "zalo", ZALO]])
        // The engine wrote no chatbot record at intake: no chat, no line, and the record tools were never asked.
        expect(db.chat.chats.size).toBe(0)
        expect(db.chat.messages.size).toBe(0)
        expect(db.chat.calls).toEqual([])

        // THE RUN.
        const woken = await runHeard(process, wakes)
        expect(woken.error).toBeNull()
        expect(woken.ending).toMatchObject({ status: "done" })
        const steps = await stepsOf(process, woken.runId ?? "")
        expect(steps[0]).toBe("hear")

        // R26: the person's line was kept by the engine's delivery, ONCE, on the route, under the source's own key; the chatbot's chat only
        // carries the route and its working state: no copy of the words, no message record of either direction.
        expect(db.chat.lines.heard.map((line) => [line.text, line.key, line.routeId, line.contactId, line.channel, line.accountId, line.eventId])).toEqual([
            [LINE, "zalo:m-hear-1", CONV, CONTACT, "zalo", ZALO, "m-hear-1"],
        ])
        expect(db.chat.chats.size).toBe(1)
        const [, chat] = [...db.chat.chats.entries()][0] ?? ["", undefined]
        expect(chat?.values).toMatchObject({ routeId: CONV, channel: "zalo", contactId: CONTACT, messageCount: 0 })
        expect(db.chat.messages.size).toBe(0)
        // Who wrote: only the chatbot agent's run, through its record tools, on its one type; never the engine.
        expect(db.chat.calls.length).toBeGreaterThan(0)
        expect(db.chat.calls.every((call) => call.agentId === FRONT)).toBe(true)
        expect(new Set(db.chat.calls.map((call) => call.type))).toEqual(new Set([CHATBOT_CHAT]))

        // THE REPLY: one delivered ledger row of that route, addressed to the person: the engine's own record of what was told.
        const delivered = db.chat.ledger.rows.filter((row) => row.routeId === CONV)
        expect(delivered.map((row) => [row.state, row.text, row.contactId])).toEqual([["delivered", REPLY, CONTACT]])
        expect(db.lines.map((line) => [line.conversationId, line.text])).toEqual([[CONV, REPLY]])
        // The thread the engine serves holds both directions in one order, from_person first.
        const thread = await chatServicesOf(db).messages.threadOf(WS, CONV)
        expect(thread.rows.toReversed().map((line) => [line.direction, line.text])).toEqual([
            ["from_person", LINE],
            ["to_person", REPLY],
        ])
    })

    it("a replay of the same wake keeps no second customer line, and a delivery the account already kept wakes nothing", async () => {
        const db = threadDbOf()
        scriptQuestion(db)
        const process = await processOf(db)
        const wakes = await customersSay(process, [{ text: LINE, key: "m-hear-2" }])
        await runHeard(process, wakes)
        // The same message delivered again by the channel: one raw row, no new wake (the wake's once-key).
        await expect(customersSay(process, [{ text: LINE, key: "m-hear-2" }])).resolves.toEqual([])
        expect(db.chat.raw).toHaveLength(1)

        // The same wake driven again (a re-drive after a lost lease): its run's `hear` finds the line under its key and writes nothing.
        db.model.script(UNDERSTAND, { done: { branch: "buy", summary: "Lan: buy" } })
        const again = await runHeard(process, wakes)
        expect(again.error).toBeNull()
        expect((await stepsOf(process, again.runId ?? ""))[0]).toBe("hear")
        expect(db.chat.chats.size).toBe(1)
        expect(db.chat.lines.heard).toHaveLength(1)
        expect(db.chat.messages.size).toBe(0)
        // And it told the customer nothing more: the buy route hands to Sales, no second reply.
        expect(db.chat.ledger.rows.filter((one) => one.routeId === CONV)).toHaveLength(1)
    })
})
