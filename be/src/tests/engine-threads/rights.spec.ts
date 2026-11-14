import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    ANSWER_NODE,
    ANSWER,
    WS,
    CORE,
    UNDERSTAND,
    customerWrites,
    processOf,
    refOf,
    rowsOf,
    seededDb,
    stopsOf,
    threadDbOf,
} from "./thread-world"
import { chatServicesOf } from "./thread-world-intake"

// The world's desk installed beside the core: an agent step that acts itself, on the template road (`thread-desk-plugin.builder.ts`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const desk: typeof import("@tests/fixtures/builders/thread-desk-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/thread-desk-plugin.builder",
    )
    return { installed: parts.installationWith([desk.DESK_PLUGIN], "world-desk") }
})

// Package 0-9, coordinator's addition: provider rights PER CONNECTED ACCOUNT on a thread, judged by the REAL AgentAccountsService
// (the door's `effectRight` and the channel send's own judgement on the conversation's connection). A refusal is a fact the step's
// agent reads; a step that cannot do what it requires stops for the founder: never a silent drop.

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

/**
 * A second person, met on a second Zalo account the agent is NOT attached to. The customer writes on the account the agent answers (an
 * event reaches only the agents attached to its account); the send is addressed to the other person, so it is judged against THEIR
 * account: the right is the calling agent's attachment to the very account the person is reached through.
 */
const otherPersonOn = (db: ReturnType<typeof threadDbOf>): Promise<string> =>
    chatServicesOf(db).contacts.meetChannel(WS, { channel: "zalo", account: "zalo-2", userId: "8800110099", name: "Hoa" })

describe("rights per connected account on a thread", () => {
    it("a send to a person on an account the agent is not attached to is refused channel_no_access and stops", async () => {
        const db = threadDbOf()
        db.rights.accounts.push({ id: "zalo-2", provider: "zalo_oa" })
        // The default customer is met first (the world's first contact), then the other person.
        await seededDb(db)
        const OTHER_PERSON = await otherPersonOn(db)
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { contactId: OTHER_PERSON, text: "Shop mo 8h-21h a." } } },
            ...Array.from({ length: 6 }, () => ({ done: { reply: "Shop mo 8h-21h a." } })),
        )
        db.model.script(CORE, report)
        const process = await processOf(db)

        const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""

        expect(db.lines).toEqual([])
        expect(JSON.stringify(db.model.askedOf(ANSWER).at(1)?.request.input)).toContain("channel_no_access")
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([
            ["answer", "ai_report", "open"],
        ])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting", engine: "langgraph" })
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
        const db = threadDbOf()
        db.rights.accounts.push({ id: "zalo-2", provider: "zalo_oa" })
        // The default customer is met first (the world's first contact), then the other person.
        await seededDb(db)
        const OTHER_PERSON = await otherPersonOn(db)
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { contactId: OTHER_PERSON, text: "Shop mo 8h-21h a." } } },
            { confused: { reason: "Khong gui duoc cho khach", question: "Gan tai khoan Zalo nao?" } },
        )
        db.model.script(CORE, report)
        const process = await processOf(db, { agentLoop: [ANSWER_NODE] })

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
