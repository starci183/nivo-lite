import { CORE_WRITE_ASK_ON, NOTE_WRITE } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { CORE, FRONT, WS, drain, itemsOf, refOf, stopsOf, threadDbOf, type ThreadDb } from "./thread-world"
import { coreProcessOf, coreStarted, noteActsOf } from "./thread-world-core"

// THE KILL SWITCH ON A THREAD (nivo-frame `rights`: there is no `never`; detaching the account from the agent IS the kill switch: no
// account, the tool is unavailable), on the GENERIC fixture (`engine-core-plugin`, graph `tcore.write-ask-on`: ONE write on a node
// declared `ask` that lists the provider `telegram`, the test write being no provider's purpose, so the node's list places it). An
// account may be detached at once while a run is PARKED on the owner's approval: the parked run is then refused at resume (the engine
// runs the approved call again through the real door and the ONE runner, which binds the node's providers to the agent's attachments:
// none is left, so nothing is sent) and the step stops for the founder: never run on the stale right, never cancelled without a word.
// Real: the thread engine, the node host, the door's checks, the runner, the approvals, the judge (`AgentAccountsService`). Faked:
// the model (scripted), the outside world, the test write's executor (`thread-world-core.ts`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** The fixture account of the provider the write's node lists. */
const ACCOUNT = "telegram-1"

const report = {
    decision: "report",
    reason: "Tai khoan da bi go khoi tro ly.",
    question: "Gan lai tai khoan hay bo qua?",
    suggestions: [
        { text: "Gan lai tai khoan", handledBy: "person" },
        { text: "Bo qua", handledBy: "person" },
    ],
    customerLine: null,
}

/** A database whose agent is attached to the fixture account of the provider the write's node lists. */
const attachedDb = (): ThreadDb => {
    const db = threadDbOf()
    db.rights.accounts.push({ id: ACCOUNT, provider: "telegram" })
    db.rights.attachments.push({ agentId: FRONT, connectionId: ACCOUNT, provider: "telegram" })
    return db
}

/** The run parked on the owner's approval of the write (its node declared `ask`): one item, one approval stop, nothing acted. */
const parked = async (db: ThreadDb) => {
    const process = await coreProcessOf(db)
    const runId = await coreStarted(process, CORE_WRITE_ASK_ON)
    expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["write", "approval", "open"]])
    expect(noteActsOf(db)).toEqual([])
    return { process, runId, workItemId: itemsOf(db)[0]?.item.id ?? "" }
}

/** The owner's yes on the one approval, admitted by the REAL approvals and run by the drain. */
const approved = async (db: ThreadDb, process: Awaited<ReturnType<typeof parked>>["process"], runId: string, workItemId: string) => {
    const from = db.wakes.length
    const decided = await process.approvals?.decided(
        { workspaceId: WS, runId, stepKey: "write", workItemId, verdict: "approved", by: "owner-1", text: "" },
        process.requests,
    )
    expect(decided).toMatchObject({ kind: "admitted" })
    return drain(process, from)
}

describe("an account detached while a run is parked on it (the kill switch)", () => {
    it("the owner approves afterwards: nothing is acted, no second approval, and the run stops on an open stop the founder reads", async () => {
        const db = attachedDb()
        const { process, runId, workItemId } = await parked(db)

        // The owner detaches the agent from the account while the approval waits.
        const at = db.rights.attachments.findIndex((one) => one.connectionId === ACCOUNT)
        db.rights.attachments.splice(at, 1)
        db.model.script(CORE, report, report)

        const ran = await approved(db, process, runId, workItemId)

        // Never run on the stale right: the approval is there, the attachment is not.
        expect(ran.map((one) => one.error)).toEqual([null])
        expect(noteActsOf(db)).toEqual([])
        // Never cancelled without a word: the run is stopped on an open stop, and no second approval is raised.
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("stopped")
        expect((await stopsOf(process, runId)).filter((stop) => stop.state === "open").map((stop) => stop.stepKey)).toEqual(["write"])
        expect(itemsOf(db)).toHaveLength(1)
    })

    it("control: with the account still attached the same approval acts the write exactly once, on that account, and the run ends", async () => {
        const db = attachedDb()
        const { process, runId, workItemId } = await parked(db)

        await approved(db, process, runId, workItemId)

        expect(noteActsOf(db)).toEqual([expect.objectContaining({ effect: NOTE_WRITE, connectionId: ACCOUNT, approvedBy: "owner-1" })])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })
})
