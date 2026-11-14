import { TOOL } from "@nivo-lite/agent-sdk/names"
import { calledWorkflow, heardCredit } from "./thread-world-intake"
import { ANSWER, CONTACT, CONV, FRONT, UNDERSTAND, ZALO, customersSay, processOf, runHeard, threadDbOf, type ThreadDb } from "./thread-world"

// MX-CORE D2-2 / D2-F1 (E-FIX9). RULE (engine words): an event is matched by the ACCOUNT it came in on. Another attached account of the
// same provider never changes which registrations or waits see it: readiness asks whether a step CAN act (some attached account of its
// provider), and WHICH account a call acts on is the call's own pick (the event's account, the run's, the agent's default, else the typed
// `TOOLS_ACCOUNT_NEEDS_PICK` at that call). And an event about a person that NO agent's registration took and no parked wait took is
// reported, never a silent `no_waiter`. Exposing case: a second Zalo account attached to the front desk hid its graph (`needs_pick`) and
// the live line ended `no_waiter`. Second kind: a bank credit on one of two bank accounts of the sales agent. The routing judges readiness
// on the shop's live attachments (`readiness: true`), as the app does.

const SALES = "sales-agent"
const LINE = "Shop mo cua may gio?"
const REPLY = "Shop mo cua tu 8h den 21h a."

/** Attaches one more account of a provider to an agent. */
const attach = (db: ThreadDb, agentId: string, connectionId: string, provider: string): void => {
    if (!db.rights.accounts.some((one) => one.id === connectionId)) db.rights.accounts.push({ id: connectionId, provider })
    db.rights.attachments.push({ agentId, connectionId, provider })
}

/** The question route of the front desk: the understand step routes to `answer`, whose agent searches once and answers. */
const scriptQuestion = (db: ThreadDb): void => {
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } }, { done: { reply: REPLY } })
}

describe("several accounts of one provider on one agent (the event's own account matches)", () => {
    it("a customer line on the live Zalo account, with a SECOND Zalo account attached to the front desk: its registration takes it and the reply goes out", async () => {
        const db = threadDbOf({ readiness: true })
        attach(db, FRONT, "zalo-sandbox", "zalo_oa")
        scriptQuestion(db)
        const process = await processOf(db)

        const wakes = await customersSay(process, [{ text: LINE, key: "m-two-1" }])

        expect(wakes).toHaveLength(1)
        expect(wakes[0]?.context).toMatchObject({ connectionId: ZALO, workflowId: expect.any(String) })
        expect(wakes[0]?.context).not.toHaveProperty("waitOnly")
        const woken = await runHeard(process, wakes)
        expect(woken.error).toBeNull()
        expect(woken.ending).toMatchObject({ status: "done" })
        expect(db.chat.ledger.rows.filter((row) => row.routeId === CONV).map((row) => [row.state, row.text])).toEqual([["delivered", REPLY]])
    })

    it("the same line with ONE Zalo account is taken the same way (the second account changed nothing)", async () => {
        const db = threadDbOf({ readiness: true })
        scriptQuestion(db)
        const process = await processOf(db)

        const wakes = await customersSay(process, [{ text: LINE, key: "m-one-1" }])

        expect(wakes[0]?.context).toMatchObject({ connectionId: ZALO, workflowId: expect.any(String) })
    })

    it("second kind: a bank credit on one of TWO bank accounts of the sales agent is taken by the registration on credits", async () => {
        const db = threadDbOf({ readiness: true, modules: { [SALES]: "sales" } })
        attach(db, SALES, ZALO, "zalo_oa")
        attach(db, SALES, "sepay-1", "sepay")
        attach(db, SALES, "sepay-2", "sepay")
        const process = await processOf(db)
        await customersSay(process, [])

        const wakes = await heardCredit(db, {
            connectionId: "sepay-2",
            provider: "sepay",
            transactionId: "tx-two-1",
            amountVnd: 450_000,
            content: "DH1001 chuyen khoan",
            at: "2026-11-10T10:00:00.000Z",
        })

        const taken = wakes.filter((wake) => wake.agentId === SALES && wake.context.workflowId !== undefined)
        expect(taken).toHaveLength(1)
        expect(taken[0]?.context).toMatchObject({ connectionId: "sepay-2" })
    })

    it("D2-F1: a hand-off to the sale whose agent holds TWO bank accounts and no default is taken (a later step's account never refuses the call)", async () => {
        const db = threadDbOf({ readiness: true, modules: { [FRONT]: "chatbot", [SALES]: "sales" } })
        attach(db, SALES, ZALO, "zalo_oa")
        attach(db, SALES, "sepay-1", "sepay")
        attach(db, SALES, "sepay-2", "sepay")
        const process = await processOf(db)
        await customersSay(process, [])

        const handed = await calledWorkflow(db, {
            agentId: SALES,
            workflow: "consult",
            params: { conversationId: CONV, text: "2 gio hoa nho", channel: "zalo", contactId: CONTACT },
            key: "call:front-desk:two-banks",
            contactId: CONTACT,
            routeId: CONV,
        })

        expect(handed).toHaveLength(1)
        expect(handed[0]?.context).toMatchObject({ workflowId: expect.any(String) })
    })

    it("a customer line no agent's registration takes, heard only by a wait that no parked run holds, is reported untaken, never silent", async () => {
        const db = threadDbOf({ readiness: true, modules: { [SALES]: "sales" } })
        db.rights.attachments.splice(0, db.rights.attachments.length)
        attach(db, SALES, ZALO, "zalo_oa")
        const process = await processOf(db)

        const wakes = await customersSay(process, [{ text: LINE, key: "m-none-1" }])

        expect(wakes).toHaveLength(1)
        expect(wakes[0]?.context).toMatchObject({ waitOnly: "true", unclaimed: "true" })
        const woken = await runHeard(process, wakes)
        expect(woken.ending).toMatchObject({ status: "skipped", reason: "no_workflow" })
        expect(woken.runId).toBeNull()
    })
})
