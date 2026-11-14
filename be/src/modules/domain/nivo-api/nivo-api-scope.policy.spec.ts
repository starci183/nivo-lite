import { Test } from "@nestjs/testing"
import { namedIdsOf, narrowedOf, scopeOf } from "./nivo-api-scope.policy"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import { NIVO_API_TABLE } from "./nivo-api.declarations"

const SUBJECT = Symbol("nivo-api-scope.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { namedIdsOf, narrowedOf, scopeOf } }],
    }).compile()
    return moduleRef.get<typeof import("./nivo-api-scope.policy")>(SUBJECT)
}


const AGENTS = { agents: [{ id: "i-1", agentId: "agent-1" }, { id: "i-2", agentId: "agent-2" }, { id: "i-3", agentId: null }] }
const STOPS = { stops: [{ stopId: "s-1", agentId: "agent-2" }, { stopId: "s-2", agentId: "agent-1" }], total: 2, next: "2" }

describe("what an agent-scoped key narrows", () => {
    let subject: Awaited<ReturnType<typeof build>>

    beforeEach(async () => {
        subject = await build()
    })

    describe("NIVO_API_SCOPES: what an agent-scoped key narrows on each op", () => {
        it("states the narrowing of every exposed op, and of no other", () => {
            const exposed = Object.entries(NIVO_API_TABLE)
                .filter(([, declaration]) => declaration.exposed)
                .map(([name]) => name)

            expect(exposed.filter((name) => subject.scopeOf(name) === undefined)).toEqual([])
            expect(subject.scopeOf(NIVO_API.workspace.delete)).toBeUndefined()
        })

        it.each([
            [NIVO_API.contact.list, "data"],
            [NIVO_API.agent.list, "agents"],
            [NIVO_API.agent.deletionImpact, "installation"],
            [NIVO_API.workflow.run, "installation"],
            [NIVO_API.run.get, "installation_run"],
            [NIVO_API.run.stepDecide, "installation_run"],
            [NIVO_API.stop.list, "stops"],
            [NIVO_API.stop.answer, "run"],
        ])("narrows %s as %s", (name, scope) => {
            expect(subject.scopeOf(name)).toBe(scope)
        })
    })

    describe("namedIdsOf", () => {
        it("reads the installation and the run an op names, and leaves the other absent", () => {
            expect(subject.namedIdsOf({ installationId: "i-1", runId: "r-1", other: true })).toMatchObject({ installationId: "i-1", runId: "r-1" })
            expect(subject.namedIdsOf({})).toEqual({})
        })

        it("refuses an id that is no text", () => {
            expect(() => subject.namedIdsOf({ installationId: 5 })).toThrow()
        })
    })

    describe("narrowedOf: the answer as an agent-scoped key sees it", () => {
        it("keeps the agents of its own agent only", () => {
            expect(subject.narrowedOf("agents", AGENTS, "agent-1")).toEqual({ agents: [{ id: "i-1", agentId: "agent-1" }] })
        })

        it("keeps the stops of its own agent only, and drops the workspace total", () => {
            expect(subject.narrowedOf("stops", STOPS, "agent-1")).toEqual({ stops: [{ stopId: "s-2", agentId: "agent-1" }], next: "2" })
        })

        it.each(["data", "installation", "installation_run", "run"] as const)("leaves the answer of a %s op as it is", (scope) => {
            expect(subject.narrowedOf(scope, STOPS, "agent-1")).toBe(STOPS)
        })
    })
})
