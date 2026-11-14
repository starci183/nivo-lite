import { mock } from "@starci/jest-preset"
import { AgentWorkReadService, tagContextOf, type AgentTurnView } from "@modules/domain/agent-work"
import {
    PROVIDER_TRIGGER_TAG_SOURCE,
    RENDER_COMPLETED,
    declarationOf,
    wakeContextOf,
    type ProviderWake,
} from "@modules/domain/provider-triggers"
import { planWakes } from "@modules/domain/provider-triggers/provider-triggers.policy"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { CORE_AGENT, CORE_AWAIT } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { FRONT, WS, drain, threadDbOf, type ThreadDb } from "./thread-world"
import { coreProcessOf, coreStarted, threadOf } from "./thread-world-core"

// WORLD (f) of the backlog: SIXTY runs parked on a `wait` that matches by VALUE (each waits for its own work id: the `ticket` of its trigger),
// and the event for the 30th resumes THAT run and only it: the others stay parked, nothing new starts. Real: the planned wake of the provider
// trigger, the flow's first look at a wake (the waits first), the waits service over the real run store (`wait_match` markers: the
// event\u0027s value must be found among the run\u0027s own), the thread engine. The GIN index that makes the lookup scale is database-only
// (migration 20261114000400); the memory `waiters` has the same semantics.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

const COMPOSE = "shotstack-1"
const RUNS = 60

const plannedRender = (renderId: string): ProviderWake => {
    const declaration = declarationOf(PROVIDER.shotstack, RENDER_COMPLETED)
    if (declaration === null) throw new Error("render.completed is not declared for shotstack")
    const [planned] = planWakes(declaration, COMPOSE, [
        { id: renderId, occurredAt: null, payload: { renderRowId: `row-${renderId}`, renderId, status: "done" } },
    ])
    if (planned === undefined) throw new Error("no wake planned")
    return planned.wake
}

const renderTurn = (db: ThreadDb, wake: ProviderWake): AgentTurnView => {
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
        wakeId: `wake-r${db.turns}`,
        eventKey: `provider:${COMPOSE}:${wake.providerTrigger}:${String(wake.params.renderId)}:${FRONT}`,
        source: "tag",
        scopeKey: `subject:video-render:${String(wake.params.renderId)}`,
        context: tagContextOf(request, JSON.stringify(wakeContextOf(wake, "notice"))),
        actorMemberId: null,
        fence: db.fence,
        turnId: `turn-${db.turns}`,
    })
}

describe("sixty parked runs, each waiting for its own value: the event for one resumes that run only", () => {
    it("the completion of render 30 resumes run 30; the other fifty-nine stay parked; no run is opened", async () => {
        const db = threadDbOf({ modules: { [FRONT]: CORE_AGENT } })
        const wakeReader = mock<AgentWorkReadService>({
            wakeContextOf: (_ws: string, agentId: string, source: string, eventKey: string) =>
                Promise.resolve(db.wakes.find((one) => one.agentId === agentId && one.source === source && one.eventKey === eventKey)?.context ?? null),
        })
        const process = await coreProcessOf(db, { outbox: jobRecordingOutbox(), extra: [{ provide: AgentWorkReadService, useValue: wakeReader }] })
        const runs: Array<string> = []
        for (let one = 1; one <= RUNS; one += 1)
            runs.push(await coreStarted(process, CORE_AWAIT, { noteId: `note-${one}`, text: "bat dau dung", ticket: `render-${one}`, locale: "vi" }, one))
        expect(new Set(runs).size).toBe(RUNS)
        const opened = db.runs.size

        const from = db.wakes.length
        const ending = await process.flows.run(renderTurn(db, plannedRender("render-30")), new AbortController().signal)
        await drain(process, from)

        expect(ending).toMatchObject({ status: "done", reason: "wait_took" })
        const statuses = await Promise.all(runs.map(async (runId) => (await threadOf(process, runId)).status))
        expect(statuses.filter((status) => status === "ended")).toHaveLength(1)
        expect(statuses[29]).toBe("ended")
        expect(statuses.filter((status) => status === "stopped")).toHaveLength(RUNS - 1)
        expect(db.runs.size).toBe(opened)
    })
})
