import { TOOL } from "@nivo-lite/agent-sdk/names"
import { CONTACT, CONV, FRONT, ANSWER, UNDERSTAND, ZALO, actsOf, customersSay, runTurns, startThread } from "../../thread-world"
import { calledWorkflow } from "../../thread-world-intake"
import { SALES } from "../reconcile/thread-world-money"
import { frontDeskFlow } from "../../thread-world-process"
import { threadStepsOf } from "../../thread-world-w8-wakes"
import { FIRST_ROUND, SALE_TRUTHS, SP, saidOf, salesWorldOf } from "./thread-world-sales"

// V28 ENTRY PATHS (R45 packages, front desk v25): a line with no words must work. (1) A picture-only line (no caption) reaches `understand` WITH its picture, is
// routed to the sale, and the sale's consult reads the pictures from the engine's thread itself (no `recentLines` any more). (2) Telegram's `/start` (data.text `/start`: `hear` reads it itself, opens a fresh
// chat and goes on with NO words) reaches `understand` as an empty message and the MODEL greets: the world asserts a
// send happened and that no text was coded; it never asserts the words of the greeting (they are the scripted model's).
// The front door of both is the real `deliver` (Zalo's entry for the picture; a direct start of the SHIPPED front desk on the generic trigger scope for the wordless line (`startThread`), because only Zalo
// has an intake in the worlds and its translate never yields an empty text; the Telegram intake end to end is backlog (h)).

const PICTURE = { id: "file-1", url: "https://files.test/hoa-mau.jpg", name: "hoa-mau.jpg", contentType: "image/jpeg" }
const UNDERSTOOD = { branch: "buy", summary: "Lan gui anh mau hoa, muon dat gio hoa nho" }

describe("v28: a picture-only line reaches understand and the sale", () => {
    it("understand is shown the picture and routes buy; the hand-off carries the visit's start; the sale's consult reads the same picture from the engine thread", async () => {
        const world = await salesWorldOf(SALE_TRUTHS)
        const { db, process } = world
        db.model.script(UNDERSTAND, { done: UNDERSTOOD })
        db.model.script(SP.consult, { done: FIRST_ROUND })

        // The words of a picture-only line are only the channel's label (no caption); the picture is kept in the shop's store with the line.
        const wakes = await customersSay(process, [{ text: "[Hinh anh]", key: "m-pic-1", files: [PICTURE] }])
        const front = await runTurns(process, wakes)

        expect(front.map((one) => one.error)).toEqual([null, null])
        expect(await threadStepsOf(process, front[0]?.runId ?? "")).toEqual(expect.arrayContaining(["hear", "understand", "to-consult"]))
        expect(JSON.stringify(db.model.askedOf(UNDERSTAND).at(-1)?.request)).toContain(PICTURE.url)
        // The hand-off to the sale (the step's tag effect): the route, the words and where the visit's window on the thread starts.
        const [handOff] = actsOf(db, TOOL.agentTag)
        const call = (handOff?.payload as { context?: { workflowCall?: { workflow: string }; params?: Record<string, unknown> } }).context
        expect(call?.workflowCall?.workflow).toBe("consult")
        expect(call?.params).toMatchObject({ conversationId: CONV, since: expect.any(String) })
        expect(call?.params).not.toHaveProperty("recentLines")

        // The sale takes the hand-off as delivered: its consult reads the engine's thread since the visit start and is shown the picture.
        const sale = await calledWorkflow(db, { agentId: SALES, workflow: "consult", params: call?.params ?? {}, key: "call:front-desk:pic", contactId: CONTACT, routeId: CONV })
        const ran = await runTurns(process, sale)
        expect(ran.map((one) => one.error)).toEqual([null])
        expect(db.model.askedOf(SP.consult)).toHaveLength(1)
        expect(JSON.stringify(db.model.askedOf(SP.consult).at(-1)?.request)).toContain(PICTURE.url)
        expect(saidOf(db)).toEqual([FIRST_ROUND.reply])
    })
})

describe("v28: a line with no words is greeted by the model", () => {
    it("understand reads an empty text, the front desk's own agent answers, a send happened and no text was coded", async () => {
        const world = await salesWorldOf(SALE_TRUTHS)
        const { db, process } = world
        const GREETING = "Chao chi, em la tro ly cua shop, chi can em giup gi a?"
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Khach mo cuoc tro chuyen" } })
        db.model.script(ANSWER, { done: { reply: GREETING } })

        const workflow = db.workflows.workflowsOf(FRONT)[0]
        const started = await startThread(process, {
            flow: frontDeskFlow(),
            versionId: workflow?.versionId ?? "",
            workflowId: `${FRONT}:${workflow?.key ?? ""}`,
            trigger: {
                eventId: "tg:start-1",
                routeId: CONV,
                contactId: CONTACT,
                accountId: ZALO,
                subject: { channel: "telegram", id: "tg-chat-1" },
                data: { messageKey: "tg:start-1", text: "/start", at: null, files: [] },
                locale: "vi",
            },
        })

        expect(started.error).toBeNull()
        expect(await threadStepsOf(process, started.runId ?? "")).toEqual(expect.arrayContaining(["hear", "understand", "answer"]))
        // understand was given NO words and was not short-circuited by a coded greeting.
        expect(JSON.stringify(db.model.askedOf(UNDERSTAND).at(-1)?.request)).toContain('"message":""')
        expect(db.model.askedOf(UNDERSTAND)).toHaveLength(1)
        // One send happened to the person's route; its words are the model's (the only place the greeting exists is the script).
        expect(db.chat.ledger.rows.filter((row) => row.state === "delivered")).toHaveLength(1)
        expect(db.chat.ledger.rows.at(-1)).toMatchObject({ routeId: CONV, contactId: CONTACT, state: "delivered" })
        expect(saidOf(db)).toEqual([GREETING])
    })
})
