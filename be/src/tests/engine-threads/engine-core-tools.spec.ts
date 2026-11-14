import {
    AGENT_WRITE_PURPOSE,
    CORE_AGENT_WRITE,
    CORE_MOVE_ASK,
    CORE_MOVE_AUTO,
    CORE_WRITE_ASK,
    CORE_WRITE_AUTO,
    MONEY_MOVE,
    NOTE_WRITE,
} from "@tests/fixtures/builders/engine-core-plugin.builder"
import { WS, drain, itemsOf, ledgerOf, stopsOf, threadDbOf, type ThreadDb, type ThreadProcess } from "./thread-world"
import { NOTE_TRIGGER, coreProcessOf, coreStarted, noteActsOf, threadOf } from "./thread-world-core"

/** A step that holds an output with an outcome. */
interface OutcomeStep {
    /** The output of the step. */
    readonly output: StepOutput
}

/** The output of a step: the outcome it ended with. */
interface StepOutput {
    /** The outcome. */
    readonly outcome: unknown
}


// ENGINE CORE: THE TOOLRUNNER (frame `nivo-frame.rights` + `engineNoBusiness`), on the GENERIC fixture plugin (`engine-core-plugin`):
// a write on a node declared `auto` runs with no stop; a node declared `ask` (or a graph step that sets `ask`) interrupts with ONE
// approval card, the yes runs the call ONCE (the ledger keeps one write, a rebuilt process replays it), the no answers `declined` to
// the node, which takes its declared branch; the workspace is bound from the run's context, never from the model's arguments; and the
// runner asks NOTHING of the tool's business meaning: the write labelled "money" (display only) behaves exactly as the unlabelled one.
// Real: the thread engine, the node host, the door's checks (`NodeToolDoorService`), the ONE runner (`ToolRunnerService`), the effect
// ledger, the approvals. Faked: the model (scripted), the outside world, the test writes' executors (`thread-world-core.ts`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** What a run of one write graph came to, in the engine's terms only (no tool name, no business word). */
interface WriteRun {
    readonly status: string | null
    readonly outcome: unknown
    readonly stops: ReadonlyArray<readonly [string, string]>
    readonly items: number
    readonly acts: number
}

const runOf = async (db: ThreadDb, process: ThreadProcess, runId: string): Promise<WriteRun> => {
    const thread = await threadOf(process, runId)
    const ended = Object.values(thread.steps).find(
        (step): step is OutcomeStep =>
            typeof step === "object" && step !== null && typeof Reflect.get(Reflect.get(step, "output") ?? {}, "outcome") === "string",
    )
    return {
        status: thread.status,
        outcome: ended?.output.outcome ?? null,
        stops: (await stopsOf(process, runId)).map((stop) => [stop.kind, stop.state] as const),
        items: itemsOf(db).length,
        acts: noteActsOf(db).length,
    }
}

/** Starts a write graph; answers the process, the run and the wake index the approval's resume starts from. */
const startedOn = async (id: string) => {
    const db = threadDbOf()
    const process = await coreProcessOf(db)
    const runId = await coreStarted(process, id)
    return { db, process, runId }
}

/** The person's verdict on the one approval of the run, admitted by the REAL approvals and run by the drain. */
const decided = async (db: ThreadDb, process: ThreadProcess, runId: string, verdict: "approved" | "refused") => {
    const from = db.wakes.length
    const workItemId = itemsOf(db)[0]?.item.id ?? ""
    const admitted = await process.approvals?.decided(
        { workspaceId: WS, runId, stepKey: "write", workItemId, verdict, by: "owner-1", text: "" },
        process.requests,
    )
    expect(admitted).toMatchObject({ kind: "admitted" })
    return drain(process, from)
}

describe("a write on a node declared auto", () => {
    it("runs with no stop and no approval: one act, the done outcome", async () => {
        const { db, process, runId } = await startedOn(CORE_WRITE_AUTO)

        expect(await runOf(db, process, runId)).toEqual({ status: "ended", outcome: "done", stops: [], items: 0, acts: 1 })
        expect(noteActsOf(db)[0]).toMatchObject({ effect: NOTE_WRITE, payload: { noteId: NOTE_TRIGGER.noteId }, approvedBy: null })
    })
})

describe("a write on a node declared ask", () => {
    it("interrupts with ONE approval card on the thread: nothing acted, nothing after it runs", async () => {
        const { db, process, runId } = await startedOn(CORE_WRITE_ASK)

        expect(await runOf(db, process, runId)).toEqual({
            status: "stopped",
            outcome: null,
            stops: [["approval", "open"]],
            items: 1,
            acts: 0,
        })
    })

    it("the yes runs the call ONCE with the approver; the ledger keeps one write; the done branch", async () => {
        const { db, process, runId } = await startedOn(CORE_WRITE_ASK)
        const ran = await decided(db, process, runId, "approved")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await runOf(db, process, runId)).toEqual({
            status: "ended",
            outcome: "done",
            stops: [["approval", "resolved"]],
            items: 1,
            acts: 1,
        })
        expect(noteActsOf(db)[0]).toMatchObject({ effect: NOTE_WRITE, approvedBy: "owner-1" })
        expect(ledgerOf(db).filter((row) => row.effectId === NOTE_WRITE)).toHaveLength(1)
    })

    it("the no answers `declined` to the node: nothing acted, the declined branch, nobody asked again", async () => {
        const { db, process, runId } = await startedOn(CORE_WRITE_ASK)
        const ran = await decided(db, process, runId, "refused")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await runOf(db, process, runId)).toEqual({
            status: "ended",
            outcome: "declined",
            stops: [["approval", "resolved"]],
            items: 1,
            acts: 0,
        })
        expect((await threadOf(process, runId)).steps).toMatchObject({ write: { output: { route: "declined", written: false } } })
    })

    it("the yes, then a kill and a rebuilt process driving the thread again: still one act (the ledger answers the replay)", async () => {
        const { db, process, runId } = await startedOn(CORE_WRITE_ASK)
        await decided(db, process, runId, "approved")
        const rebuilt = await coreProcessOf(db)
        // The same wake driven again from a new process (the sweep's re-drive of a thread that already ended is a no-op or a replay).
        await drain(rebuilt, 0)

        expect(noteActsOf(db)).toHaveLength(1)
        expect(ledgerOf(db).filter((row) => row.effectId === NOTE_WRITE)).toHaveLength(1)
        expect((await threadOf(rebuilt, runId)).status).toBe("ended")
    })
})

describe("the workflow decides the mode: a graph step setting ask on a node declared auto", () => {
    it("asks once, and the yes runs the call once", async () => {
        const { db, process, runId } = await startedOn(CORE_MOVE_ASK)
        expect(await runOf(db, process, runId)).toMatchObject({ status: "stopped", stops: [["approval", "open"]], items: 1, acts: 0 })

        await decided(db, process, runId, "approved")
        expect(await runOf(db, process, runId)).toMatchObject({ status: "ended", outcome: "done", acts: 1 })
    })
})

describe("no business in the runner: a write labelled money behaves as the one labelled nothing", () => {
    it("under auto: the same run, the same acts", async () => {
        const plain = await startedOn(CORE_WRITE_AUTO)
        const money = await startedOn(CORE_MOVE_AUTO)

        expect(await runOf(money.db, money.process, money.runId)).toEqual(await runOf(plain.db, plain.process, plain.runId))
        expect(noteActsOf(money.db).map((act) => act.effect)).toEqual([MONEY_MOVE])
    })

    it("under ask: the same card, and the same run after the yes and after the no", async () => {
        const plain = await startedOn(CORE_WRITE_ASK)
        const money = await startedOn(CORE_MOVE_ASK)
        expect(await runOf(money.db, money.process, money.runId)).toEqual(await runOf(plain.db, plain.process, plain.runId))

        await decided(plain.db, plain.process, plain.runId, "approved")
        await decided(money.db, money.process, money.runId, "approved")
        expect(await runOf(money.db, money.process, money.runId)).toEqual(await runOf(plain.db, plain.process, plain.runId))

        const plainNo = await startedOn(CORE_WRITE_ASK)
        const moneyNo = await startedOn(CORE_MOVE_ASK)
        await decided(plainNo.db, plainNo.process, plainNo.runId, "refused")
        await decided(moneyNo.db, moneyNo.process, moneyNo.runId, "refused")
        expect(await runOf(moneyNo.db, moneyNo.process, moneyNo.runId)).toEqual(
            await runOf(plainNo.db, plainNo.process, plainNo.runId),
        )
    })
})

describe("the workspace is bound from the run's context, never from the model", () => {
    it("a model that writes a workspace (and a tenant) into its call's arguments reaches neither: the act is the run's workspace", async () => {
        const db = threadDbOf()
        db.model.script(
            AGENT_WRITE_PURPOSE,
            { call: { tool: NOTE_WRITE, args: { noteId: "n9", text: "x", workspaceId: "ws-other", tenantId: "ws-other" } } },
            { done: { said: "x" } },
        )
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_AGENT_WRITE)

        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(noteActsOf(db)).toHaveLength(1)
        expect(noteActsOf(db)[0]?.workspaceId).toBe(WS)
        expect(noteActsOf(db)[0]?.payload).toEqual({ noteId: "n9", text: "x" })
        expect(ledgerOf(db).every((row) => JSON.stringify(row).includes("ws-other") === false)).toBe(true)
    })

    it("a model that calls a tool its node does not declare: nothing is acted", async () => {
        const db = threadDbOf()
        db.model.script(
            AGENT_WRITE_PURPOSE,
            { call: { tool: MONEY_MOVE, args: { noteId: "n9", text: "x" } } },
            { done: { said: "x" } },
            { done: { said: "x" } },
        )
        const process = await coreProcessOf(db)
        await coreStarted(process, CORE_AGENT_WRITE)

        expect(noteActsOf(db).filter((act) => act.effect === MONEY_MOVE)).toEqual([])
    })
})
