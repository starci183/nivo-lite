import { mock } from "@starci/jest-preset"
import { PROVIDER, TRIGGER, type ProviderKey } from "@nivo-lite/agent-sdk/names"
import { templateGraphProblems } from "@nivo-lite/agent-sdk/template"
import { AgentWorkflowTriggerReceiversService } from "@modules/domain/agent-graphs/agent-workflow-trigger-receivers.service"
import { templateTriggerLookup } from "@modules/domain/agent-graphs/policies/template-lookups.policy"
import { AgentWorkReadService, tagContextOf, type AgentTurnView } from "@modules/domain/agent-work"
import {
    PROVIDER_TRIGGER_TAG_SOURCE,
    RENDER_COMPLETED,
    declarationOf,
    wakeContextOf,
    type ProviderWake,
} from "@modules/domain/provider-triggers"
import { planWakes } from "@modules/domain/provider-triggers/provider-triggers.policy"
import type { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import {
    AWAIT_MINUTES,
    CORE_AGENT,
    CORE_AWAIT,
    NOTE_WRITE,
    awaitGraph,
} from "@tests/fixtures/builders/engine-core-plugin.builder"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { FRONT, WS, drain, stopsOf, threadDbOf, type ThreadDb, type ThreadProcess, type Woken } from "./thread-world"
import { coreProcessOf, coreStarted, noteActsOf, threadOf } from "./thread-world-core"

// ENGINE CORE: A TRIGGER LISTED ONLY IN A `wait` STEP (generic). The agent's graph G registers NO head trigger for the verb (the generic
// `video.render.completed`, whichever compose provider rendered); its first step starts outside work, then the run WAITS on the same thread
// for that work's completion, matched by the work's id. Real: the provider trigger's planned wake and its context (`planWakes`,
// `wakeContextOf`, the catalogue's declaration), who an account's event reaches (`AgentWorkflowTriggerReceiversService.registered`: head
// triggers OR a wait of an active workflow), the flow's take and run of the wake (the waits first, then `no_waiter`), the thread engine,
// the wait node (park + deadline job), the once-key of the park and the drain. Faked: the outside world, the test write's executor, the
// queue outbox (it records the job), the attachments (one compose account of the agent).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** The compose account of the agent the render's webhook came on. */
const COMPOSE = "shotstack-1"

/** The run's trigger: the note, its line and the ticket of the work its first step started (the id the completion names). */
const TRIGGER_SCOPE = { noteId: "note-1", text: "bat dau dung", ticket: "render-77", locale: "vi" }

/** The texts the run wrote, in order. */
const linesOf = (db: ThreadDb): ReadonlyArray<unknown> =>
    noteActsOf(db)
        .filter((act) => act.effect === NOTE_WRITE)
        .map((act) => act.payload.text)

/** The deadline job of the park, as it was armed. */
const deadlineOf = (runId: string) => ({ workspaceId: WS, runId, stepKey: "hold", repeats: 0, answered: -2 })

/** A run of the await graph of the agent, parked on its wait; the agent's workflows are the fixture's (the await graph among them). */
const parked = async () => {
    const db = threadDbOf({ modules: { [FRONT]: CORE_AGENT } })
    const outbox = jobRecordingOutbox()
    // The work core's reader of a kept wake (the app's): a retried event's wake finds the park's one wake is its own.
    const wakeReader = mock<AgentWorkReadService>({
        wakeContextOf: (_ws: string, agentId: string, source: string, eventKey: string) =>
            Promise.resolve(db.wakes.find((one) => one.agentId === agentId && one.source === source && one.eventKey === eventKey)?.context ?? null),
    })
    const process = await coreProcessOf(db, { outbox, extra: [{ provide: AgentWorkReadService, useValue: wakeReader }] })
    const runId = await coreStarted(process, CORE_AWAIT, TRIGGER_SCOPE)
    return { db, outbox, process, runId }
}

/** The ONE planned wake of a render completion on the compose account, as the emit point plans it from the catalogue's declaration. */
const plannedRender = (renderId: string, status = "done"): ProviderWake => {
    const declaration = declarationOf(PROVIDER.shotstack, RENDER_COMPLETED)
    if (declaration === null) throw new Error("render.completed is not declared for shotstack")
    const [planned] = planWakes(declaration, COMPOSE, [
        { id: renderId, occurredAt: null, payload: { renderRowId: `row-${renderId}`, renderId, status } },
    ])
    if (planned === undefined) throw new Error("no wake planned")
    return planned.wake
}

/** The turn the tag door's wake of a planned render gives the flow (the emit point's tag: its trigger, the account, the params). */
const renderTurn = (db: ThreadDb, wake: ProviderWake, wakeId?: string): AgentTurnView => {
    db.turns += 1
    db.fence += 1
    const request = {
        source: PROVIDER_TRIGGER_TAG_SOURCE,
        workspaceId: WS,
        toAgentId: FRONT,
        text: wake.providerTrigger,
        subject: `video-render:${String(wake.params.renderId)}`,
    }
    return agentTurnViewOf({
        workspaceId: WS,
        agentId: FRONT,
        wakeId: wakeId ?? `wake-r${db.turns}`,
        eventKey: `provider:${COMPOSE}:${wake.providerTrigger}:${String(wake.params.renderId)}:${FRONT}`,
        source: "tag",
        scopeKey: `subject:video-render:${String(wake.params.renderId)}`,
        context: tagContextOf(request, JSON.stringify(wakeContextOf(wake, "notice"))),
        actorMemberId: null,
        fence: db.fence,
        turnId: `turn-${db.turns}`,
    })
}

/** Who an account's event reaches: the REAL receivers over the world's routing, the agent attached to the compose account. */
const receiversOf = (db: ThreadDb): AgentWorkflowTriggerReceiversService => {
    const access = mock<AccountAttachmentsService>({
        listOfWorkspace: () => Promise.resolve([{ agentId: FRONT, connectionId: COMPOSE, provider: PROVIDER.shotstack }]),
    })
    return new AgentWorkflowTriggerReceiversService(access, db.workflows.service)
}

/** A render's wake through the REAL flow, as the drain runs it: asked whether it takes it, then run; the wakes it wrote run after. */
const renderCame = async (process: ThreadProcess, turn: AgentTurnView): Promise<{ readonly takes: boolean; readonly woken: Woken }> => {
    const { db } = process
    const from = db.wakes.length
    const takes = await process.flows.takes(turn)
    const ending = await process.flows.run(turn, new AbortController().signal)
    await drain(process, from)
    return { takes, woken: { ending, runId: null, error: null } }
}

describe("a trigger only a `wait` step lists reaches the waiting thread", () => {
    it("the agent listens to the verb through its wait: the account's render event is delivered to it, a mail is not", async () => {
        const { db } = await parked()
        const receivers = receiversOf(db)

        await expect(receivers.attachedTo(WS, COMPOSE)).resolves.toEqual([FRONT])
        const mail: ProviderWake = { providerTrigger: "imap:mail.received", connectionId: COMPOSE, params: { eventIds: ["s1"], count: 1 } }
        await expect(receivers.registered(WS, FRONT, [plannedRender("render-77"), mail])).resolves.toEqual([true, false])
    })

    it("the matching completion resumes the SAME thread along `completed`, with the event as the step's output; nothing new starts", async () => {
        const { db, process, runId } = await parked()
        expect((await threadOf(process, runId)).status).toBe("stopped")
        const runsBefore = db.runs.size

        const came = await renderCame(process, renderTurn(db, plannedRender("render-77")))

        expect(came.takes).toBe(true)
        expect(came.woken.ending).toMatchObject({ status: "done", reason: "wait_took" })
        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("ended")
        expect(thread.steps.hold).toMatchObject({
            output: { trigger: "completed", event: { renderId: "render-77", renderRowId: "row-render-77", status: "done" } },
        })
        expect(linesOf(db)).toEqual(["bat dau dung", "done"])
        expect(db.runs.size).toBe(runsBefore)
        expect(await stopsOf(process, runId)).toEqual([])
    })

    it("a completion of ANOTHER render resumes nothing and ends `no_waiter`: no run, no report, the thread still waits", async () => {
        const { db, process, runId } = await parked()
        const runsBefore = db.runs.size
        const teamBefore = db.team.length

        const came = await renderCame(process, renderTurn(db, plannedRender("render-other")))

        expect(came.takes).toBe(true)
        expect(came.woken.ending).toEqual({ status: "skipped", reason: "no_waiter", outcome: null })
        expect((await threadOf(process, runId)).status).toBe("stopped")
        expect(db.runs.size).toBe(runsBefore)
        expect(db.team.length).toBe(teamBefore)
        expect(linesOf(db)).toEqual(["bat dau dung"])
    })

    it("the timeout road still works: once due the deadline resumes along `timeout`; a completion after it resumes nothing", async () => {
        const { db, process, runId } = await parked()
        db.clock.advance((AWAIT_MINUTES + 1) * 60_000)
        const before = db.wakes.length
        await expect(process.deadlines?.fire(deadlineOf(runId))).resolves.toBe("admitted")
        await drain(process, before)

        expect((await threadOf(process, runId)).steps.hold).toMatchObject({ output: { trigger: "timeout" } })
        const late = await renderCame(process, renderTurn(db, plannedRender("render-77")))
        expect(late.woken.ending).toEqual({ status: "skipped", reason: "no_waiter", outcome: null })
        expect(linesOf(db)).toEqual(["bat dau dung", "het gio"])
    })

    it("replay-safe: the same wake tried again before the thread ran, and a second delivery of the event, resume the thread once", async () => {
        const { db, process, runId } = await parked()
        const wake = plannedRender("render-77")
        const from = db.wakes.length

        // The wake's first try writes the park's one wake (the once-key); its retry finds that wake its own; the thread then runs once.
        const first = await process.flows.run(renderTurn(db, wake, "wake-render"))
        const retry = await process.flows.run(renderTurn(db, wake, "wake-render"))
        expect(db.wakes.length - from).toBe(1)
        await drain(process, from)
        const again = await renderCame(process, renderTurn(db, wake))

        expect(first).toMatchObject({ reason: "wait_took" })
        expect(retry).toMatchObject({ reason: "wait_took" })
        expect(again.woken.ending).toEqual({ status: "skipped", reason: "no_waiter", outcome: null })
        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(linesOf(db)).toEqual(["bat dau dung", "done"])
    })

    it("the save check agrees: a wait on the render verb is served by a compose account, refused for an agent of none", () => {
        const check = (agentAccounts: ReadonlyArray<ProviderKey>) =>
            templateGraphProblems(awaitGraph.spec, { nodes: awaitGraph.nodes, triggers: templateTriggerLookup, agentAccounts })
                .map((one) => one.code)
                .filter((code) => code.startsWith("WAIT_"))
        expect(check([PROVIDER.zaloOa, PROVIDER.shotstack])).toEqual([])
        expect(check([PROVIDER.zaloOa])).toEqual(["WAIT_TRIGGER_UNSERVED"])
        expect(TRIGGER.videoRenderCompleted).toBe("nivo.trigger.video.render.completed")
    })
})
