import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS, TOOL } from "@nivo-lite/agent-sdk/names"
import {
    AGENT_DEFAULTS_PURPOSE,
    CORE_AGENT_DEFAULTS,
    CORE_AGENT_DEFAULTS_ASK,
    NOTE_WRITE,
} from "@tests/fixtures/builders/engine-core-plugin.builder"
import { WS, drain, itemsOf, stopsOf, threadDbOf } from "./thread-world"
import { coreProcessOf, coreStarted, noteActsOf, threadOf } from "./thread-world-core"

// ENGINE CORE: THE DEFAULT TOOLS (owner): an AI step holds the read-context tools and every node the record and file tools without its
// template listing them; `tools` lists only what acts OUTSIDE. Real: the thread engine, the node host, the SDK's template runner (what it
// offers and lets through), the door (`NodeToolDoorService`), the runner, the approvals. Faked: the model (scripted) and the gateway behind
// the door (`thread-world-outside.ts`: it answers the reads and asks for the tools `rights.asks` names, as the gateway asks for a write
// of a step whose node mode is `ask`: `grant.policy.spec.ts` holds the gateway's own verdict on a default tool).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

const READ = { call: { tool: TOOL.brainSearch, args: { query: "goi lai" } } } as const
const RECORD = { call: { tool: TOOL.recordCreate, args: { type: "tcore.note", values: { text: "goi lai" } } } } as const
const OUTSIDE = { call: { tool: NOTE_WRITE, args: { noteId: "n1", text: "x" } } } as const

/** The tools the door let through, in order (once per call key). */
const calledOf = (db: ReturnType<typeof threadDbOf>): ReadonlyArray<string> => (db.rights.toolCalls ?? []).map((call) => call.tool)

describe("default tools on a thread", () => {
    it("an AI step whose subset names none of its tools calls an unlisted read and an unlisted record write: both run", async () => {
        const db = threadDbOf()
        db.model.script(AGENT_DEFAULTS_PURPOSE, READ, RECORD, { done: { said: "kept" } })
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_AGENT_DEFAULTS)

        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(calledOf(db)).toEqual([TOOL.brainSearch, TOOL.recordCreate])
        expect(await stopsOf(process, runId)).toEqual([])
    })

    it("the tools the AI step is offered: every default beside the node's own; the listed outside tool left out by the subset", async () => {
        const db = threadDbOf()
        db.model.script(AGENT_DEFAULTS_PURPOSE, { done: { said: "nothing" } })
        const process = await coreProcessOf(db)
        await coreStarted(process, CORE_AGENT_DEFAULTS)

        const shown = JSON.stringify(db.model.askedOf(AGENT_DEFAULTS_PURPOSE)[0]?.request)
        for (const id of [...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS]) expect(shown).toContain(id)
    })

    it("an unlisted OUTSIDE call (here: a tool the subset left out) is refused to the model, never made", async () => {
        const db = threadDbOf()
        db.model.script(AGENT_DEFAULTS_PURPOSE, OUTSIDE, { done: { said: "x" } })
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_AGENT_DEFAULTS)

        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(noteActsOf(db)).toEqual([])
        expect(calledOf(db)).toEqual([])
    })

    it("the step's mode applies to a default write: under `ask` the record write stops for a person, the yes runs it once", async () => {
        const db = threadDbOf()
        db.rights.asks?.add(TOOL.recordCreate)
        db.model.script(AGENT_DEFAULTS_PURPOSE, RECORD, { done: { said: "kept" } })
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_AGENT_DEFAULTS_ASK)

        expect((await threadOf(process, runId)).status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => [stop.kind, stop.state])).toEqual([["approval", "open"]])
        expect(db.rights.toolCalls).toEqual([])

        const from = db.wakes.length
        const workItemId = itemsOf(db)[0]?.item.id ?? ""
        const admitted = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: "think", workItemId, verdict: "approved", by: "owner-1", text: "" },
            process.requests,
        )
        expect(admitted).toMatchObject({ kind: "admitted" })
        db.model.script(AGENT_DEFAULTS_PURPOSE, { done: { said: "kept" } })
        await drain(process, from)

        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(db.rights.toolCalls?.map((call) => [call.tool, call.approvedBy])).toEqual([[TOOL.recordCreate, "owner-1"]])
    })
})
