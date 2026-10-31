import { Test } from "@nestjs/testing"
import { agentTriggerRowOf, agentTurnRowOf, unmeteredTurnRowOf } from "@tests/fixtures/builders/agent-work.builder"
import { defaultSettings, defaultState, toTriggerRecord, toTurnRecord } from "./agent-work.mapper"

const SUBJECT = Symbol("agent-work.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { defaultSettings, defaultState, toTriggerRecord, toTurnRecord } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-work.mapper")>(SUBJECT)
}

const WHEN = new Date("2026-11-10T03:00:00.000Z")
const WAKE = { source: "tag" as const, status: "done" as const, reason: null, createdAt: WHEN }

describe("defaults", () => {
    it("turns work on, on the core road, for a workspace and an agent with no row", async () => {
        const { defaultSettings, defaultState } = await buildSubject()

        expect(defaultSettings("ws-1")).toEqual({
            workspaceId: "ws-1",
            workEnabled: true,
            road: "core",
            backgroundDailyCap: 200,
        })
        expect(defaultState("agent-1")).toMatchObject({ agentId: "agent-1", workEnabled: true, failures: 0 })
    })
})

describe("toTriggerRecord", () => {
    it("drops the seconds of the time of day", async () => {
        const { toTriggerRecord } = await buildSubject()

        expect(toTriggerRecord(agentTriggerRowOf()).atTime).toBe("08:30")
    })

    it("keeps a missing time of day missing", async () => {
        const { toTriggerRecord } = await buildSubject()

        expect(toTriggerRecord(agentTriggerRowOf({ atTime: null })).atTime).toBeNull()
    })
})

describe("toTurnRecord", () => {
    it("lists the usage and the wake and carries neither the proposal nor any words", async () => {
        const { toTurnRecord } = await buildSubject()

        const record = toTurnRecord(agentTurnRowOf({ cost: "0.012500", durationMs: 900 }), WAKE)

        expect(record).toEqual({
            id: "turn-1",
            source: "tag",
            wakeStatus: "done",
            reason: null,
            status: "settled",
            model: "p/m",
            promptTokens: 3,
            completionTokens: 2,
            cost: 0.0125,
            durationMs: 900,
            workItemId: null,
            wokeAt: WHEN,
        })
        expect(JSON.stringify(record)).not.toContain("private")
    })

    it.each([
        [{ replied: true, workItemId: "item-1" }, "item-1"],
        [{ workItemId: 7 }, null],
        ["text", null],
        [null, null],
    ])(
        "reads the work item a turn opened from the outcome %j as %j, and nothing else of it",
        async (outcome, expected) => {
            const { toTurnRecord } = await buildSubject()

            const withOutcome = { outcome }

            expect(toTurnRecord(agentTurnRowOf(withOutcome), WAKE).workItemId).toBe(expected)
        },
    )

    it("keeps a cost nobody measured as null", async () => {
        const { toTurnRecord } = await buildSubject()

        expect(toTurnRecord(unmeteredTurnRowOf(), WAKE).cost).toBeNull()
    })
})
