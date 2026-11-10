import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL, coreEffects } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    CONV,
    CORE,
    FRONT_DESK,
    UNDERSTAND,
    actsOf,
    customerWrites,
    processOf,
    refOf,
    rowsOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// Package 0-9, coordinator's addition: provider rights PER CONNECTED ACCOUNT on a thread, judged by the REAL ProviderAbilitiesService
// (the door's `effectRight` and the channel send's own judgement on the conversation's connection). A refusal is a fact the step's
// agent reads; a step that cannot do what it requires stops for the founder: never a silent drop.

const SEND_QR = "payment.request:send-qr"

const report = {
    decision: "report",
    reason: "Khong gui duoc.",
    question: "Lam gi tiep?",
    suggestions: [
        { text: "Gan tai khoan", handledBy: "person" },
        { text: "Bo qua", handledBy: "person" },
    ],
    customerLine: null,
}

const QR_EFFECTS: ReadonlyArray<string> = [TOOL.paymentQrCreate, TOOL.careSchedule, TOOL.customerMessageSend]

/** One step that sends the QR of an order (the sales node `payment.request`), with its effects granted. */
const qrFlow: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: [] },
    // The rights the three effects declare, granted as a template grants them.
    grant: {
        rights: coreEffects.filter((effect) => QR_EFFECTS.includes(effect.id)).flatMap((effect) => [...effect.rights]),
        tools: [],
        effects: [...QR_EFFECTS],
    },
    nodes: [
        {
            key: "send-qr",
            kind: "output",
            step: "payment.request",
            params: {
                orderId: { $ref: "trigger.orderId" },
                conversationId: { $ref: "trigger.conversationId" },
                locale: { $ref: "trigger.locale" },
            },
        },
    ],
}

const startsQr = (db: ThreadDb) =>
    processOf(db, { flag: [FRONT_DESK] }).then((process) =>
        startThread(process, {
            flow: qrFlow,
            versionId: "chatbot-agent:send-qr@1",
            trigger: { orderId: "order-1", conversationId: CONV, locale: "vi" },
            scopeKey: `conversation:${CONV}`,
        }).then((woken) => ({ process, woken })),
    )

describe("rights per connected account on a thread", () => {
    it("a send on a conversation whose account the agent is not attached to is refused channel_no_access and stops", async () => {
        const db = threadDbOf({ connectionId: "zalo-2" })
        db.rights.accounts.push({ id: "zalo-2", provider: "zalo_oa" })
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: "Shop mo 8h-21h a." } } },
            ...Array.from({ length: 6 }, () => ({ done: { reply: "Shop mo 8h-21h a." } })),
        )
        db.model.script(CORE, report)
        const process = await processOf(db, { flag: [FRONT_DESK] })

        const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""

        expect(db.lines).toEqual([])
        expect(JSON.stringify(db.model.askedOf(ANSWER).at(1)?.request.input)).toContain("channel_no_access")
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([
            ["answer", "ai_report", "open"],
        ])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting", engine: "langgraph" })
    })

    it("a QR with no default receiving account (two accounts, none named) is refused no_default_account and stops", async () => {
        const db = threadDbOf()
        db.rights.accounts.push({ id: "sepay-2", provider: "sepay" })
        db.model.script(
            SEND_QR,
            { call: { tool: TOOL.paymentQrCreate, args: { orderId: "order-1" } } },
            { confused: { reason: "Khong co tai khoan nhan mac dinh", question: "Dung tai khoan nao?" } },
        )
        db.model.script(CORE, report)

        const { process, woken } = await startsQr(db)
        const runId = woken.runId ?? ""

        expect(woken.error).toBeNull()
        expect(actsOf(db, TOOL.paymentQrCreate)).toEqual([])
        expect(JSON.stringify(db.model.askedOf(SEND_QR).at(1)?.request.input)).toContain("no_default_account")
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.state])).toEqual([["send-qr", "open"]])
    })

    it("control: with the default receiving account named, the QR is acted once on it and the step completes", async () => {
        const db = threadDbOf()
        db.rights.accounts.push({ id: "sepay-2", provider: "sepay" })
        db.rights.defaults.set("payment", "sepay-1")
        db.model.script(
            SEND_QR,
            { call: { tool: TOOL.paymentQrCreate, args: { orderId: "order-1" } } },
            { done: { orderId: "order-1", sent: true } },
        )

        const { process, woken } = await startsQr(db)
        const runId = woken.runId ?? ""

        expect(woken.error).toBeNull()
        expect(actsOf(db, TOOL.paymentQrCreate)).toHaveLength(1)
        expect(await stopsOf(process, runId)).toEqual([])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })
})

/** The messages an agent turn of the world's model was sent, as kind and text. */
const isMessages = (input: unknown): input is { readonly messages: ReadonlyArray<readonly [string, string]> } =>
    typeof input === "object" && input !== null && Array.isArray(Reflect.get(input, "messages"))

// L2-5 (package P8): the same refusal on the host's own agent loop (`AGENT_LOOP=prebuilt:chatbot.answer`). The door's refusal is no
// throw: it reaches the model as the content of the tool message of its call (`{ ok: false, refused: { code, data } }`), the model's
// next turn is sent it, and the step that cannot do what it requires stops for the founder.
describe("rights per connected account on the prebuilt agent loop", () => {
    it("a refused send reaches the model as a readable tool result on its next turn; nothing delivered; the step stops", async () => {
        const db = threadDbOf({ connectionId: "zalo-2" })
        db.rights.accounts.push({ id: "zalo-2", provider: "zalo_oa" })
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: "Shop mo 8h-21h a." } } },
            { confused: { reason: "Khong gui duoc cho khach", question: "Gan tai khoan Zalo nao?" } },
        )
        db.model.script(CORE, report)
        const process = await processOf(db, { flag: [FRONT_DESK], agentLoop: ["chatbot.answer"] })

        const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""

        expect(db.lines).toEqual([])
        const second = db.model.askedOf(ANSWER).at(1)?.request.input
        const [kind, content] = (isMessages(second) ? second.messages.at(-1) : undefined) ?? ["", ""]
        expect(kind).toBe("tool")
        expect(content).toContain('"ok":false')
        expect(content).toContain("channel_no_access")
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([
            ["answer", "ai_report", "open"],
        ])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting", engine: "langgraph" })
    })
})
