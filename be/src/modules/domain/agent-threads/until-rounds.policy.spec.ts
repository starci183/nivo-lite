import { CALL_WORKFLOW_STEP } from "@nivo-lite/agent-sdk/graph"
import { LOOP_STEP, OUTCOME_STEP } from "@nivo-lite/agent-sdk/node"
import { TEMPLATE_IF_STEP, TEMPLATE_WAIT_STEP } from "@modules/domain/installed-plugins"
import { THREAD_END } from "@modules/integrations/langgraph"
import type { CompiledStep } from "./template-compiler.policy"
import { TEMPLATE_HAND_BACK_STEP } from "./thread-hand-back.policy"
import {
    isParkPayload,
    meaningHolds,
    parkMatches,
    parkOfQuestion,
    parkPayloadOf,
    roundInputOf,
    roundLeft,
    roundStepKeyOf,
    untilFrameOf,
    untilJudged,
    untilParkOf,
    untilStarted,
    type UntilFrame,
} from "./until-rounds.policy"

const step = (key: string, inLoop?: string): CompiledStep => ({
    key,
    step: "spec.step",
    kind: "execute",
    exit: { kind: "next", to: inLoop ?? THREAD_END },
    ends: [],
    ...(inLoop === undefined ? {} : { inLoop }),
})

const data = { until: { kind: "data" as const, expr: {} }, max: 3, everyMs: null }

describe("the until round counter", () => {
    it("starts at round 1, keys a body step by its round, and hands the round as the item", () => {
        const frame = untilStarted("poll")
        expect(frame).toEqual({ kind: "until", nodeKey: "poll", round: 1, route: null, last: null, ended: null })
        expect(untilFrameOf(JSON.parse(JSON.stringify(frame)))).toEqual(frame)
        expect(untilFrameOf({ nodeKey: "each", index: 0, items: [], joins: [] })).toBeNull()
        expect(roundStepKeyOf(step("note", "poll"), frame)).toBe("poll[r1].note")
        expect(roundStepKeyOf(step("done"), frame)).toBeNull()
        expect(roundInputOf({ ...frame, round: 2 })).toEqual({
            item: { value: { $round: 2 }, index: 1, key: "r2" },
            loop: { nodeKey: "poll", index: 1, items: [] },
        })
    })

    it("ends a round when a body node goes back to the loop, keeping the meaning node's route", () => {
        const frame = untilStarted("ask")
        const judge: CompiledStep = { ...step("judge", "ask"), step: "spec.judge" }
        const meaning = { until: { kind: "meaning" as const, node: "judge", stop: "stop" } }
        const left = roundLeft(frame, { ...judge, exit: { kind: "branch", field: "route", routes: {}, otherwise: "ask" } }, meaning, {
            output: { route: "stop" },
            toLoop: true,
            at: "2026-11-12T08:00:00.000Z",
        })
        expect(left).toEqual({
            ...frame,
            route: "stop",
            last: { route: "stop" },
            ended: { at: "2026-11-12T08:00:00.000Z", output: { route: "stop" } },
        })
        // Ruling R46 moved this expectation: a node step that does not end the round now keeps its output as the round's `last` (it
        // was `null`, "nothing changes", when `last` was taken from whatever step ended the round).
        const noted = roundLeft(frame, step("note", "ask"), meaning, { output: { n: 1 }, toLoop: false, at: "x" })
        expect(noted).toEqual({ ...frame, last: { n: 1 } })
        expect(left !== null && meaningHolds(left, { ...meaning, max: 3, everyMs: null })).toBe(true)
    })

    describe("a round's `last` is the output of its last NODE step (ruling R46, the SDK's `last`)", () => {
        const AT = "2026-11-14T07:30:00.000Z"
        const when = (key: string): CompiledStep => ({ ...step(key, "talk"), step: TEMPLATE_IF_STEP })
        /** The frame once `body` completed on `from` (a frame, or a round that just started), going back to the loop or not. */
        const after = (from: UntilFrame | null, body: CompiledStep, output: unknown, toLoop: boolean): UntilFrame | null =>
            from === null ? null : roundLeft(from, body, null, { output, toLoop, at: toLoop ? AT : "x" })
        const judged = (frame: UntilFrame | null, holds: boolean) => (frame === null ? null : untilJudged(frame, data, holds))

        it("a round ending on an if-step keeps the node before it, never the if's `{ branch }`", () => {
            const afterNode = after(untilStarted("talk"), step("consult", "talk"), { off: true }, false)
            expect(afterNode).toEqual({ ...untilStarted("talk"), last: { off: true } })
            const ended = after(afterNode, when("off-round"), { branch: "yes" }, true)
            expect(ended?.ended).toEqual({ at: AT, output: { off: true } })
            expect(judged(ended, true)).toEqual({ kind: "stopped", output: { rounds: 1, stopped: true, last: { off: true } } })
        })

        it("a round ending on a node step keeps that node's output, over a node and an if before it", () => {
            const first = after(untilStarted("talk"), step("consult", "talk"), { off: true }, false)
            expect(after(first, when("off-round"), { branch: "yes" }, false)).toBeNull()
            const ended = after(first, step("notice", "talk"), { posted: true }, true)
            expect(ended?.ended).toEqual({ at: AT, output: { posted: true } })
        })

        it("a round whose only steps are control steps ends with `last` null", () => {
            const ended = after(untilStarted("talk"), when("off-round"), { branch: "no" }, true)
            expect(ended).toEqual({ ...untilStarted("talk"), ended: { at: AT, output: null } })
            expect(judged(ended, true)).toMatchObject({ output: { rounds: 1, stopped: true, last: null } })
            for (const control of [TEMPLATE_WAIT_STEP, TEMPLATE_HAND_BACK_STEP, OUTCOME_STEP, CALL_WORKFLOW_STEP, LOOP_STEP]) {
                const body: CompiledStep = { ...step("c", "talk"), step: control }
                expect(after(untilStarted("talk"), body, { x: 1 }, true)?.ended).toEqual({ at: AT, output: null })
            }
        })

        it("a new round starts with no `last` of the round before", () => {
            const ended = after(untilStarted("talk"), step("consult", "talk"), { off: false }, true)
            expect(judged(ended, false)).toMatchObject({ kind: "again", frame: { round: 2, last: null, ended: null } })
        })
    })

    it("judges after a round: stop, exhausted at `max`, or the next round due at round end + every", () => {
        const ended = { ...untilStarted("poll"), ended: { at: "2026-11-12T08:00:00.000Z", output: { n: 1 } } }
        expect(untilJudged(ended, data, true)).toEqual({ kind: "stopped", output: { rounds: 1, stopped: true, last: { n: 1 } } })
        expect(untilJudged({ ...ended, round: 3 }, data, false)).toEqual({
            kind: "exhausted",
            output: { rounds: 3, stopped: false, last: { n: 1 } },
        })
        expect(untilJudged(ended, data, false)).toEqual({
            kind: "again",
            frame: { ...ended, round: 2, route: null, last: null, ended: null },
            dueAt: null,
        })
        expect(untilJudged(ended, { ...data, everyMs: 30 * 60_000 }, false)).toMatchObject({ dueAt: "2026-11-12T08:30:00.000Z" })
    })

    it("files a park and its timer under the round's key, apart from every stop", () => {
        const park = untilParkOf("poll", 2, "2026-11-12T08:30:00.000Z")
        expect(park.parkKey).toBe("poll[r2]")
        expect(parkOfQuestion(JSON.parse(JSON.stringify(park)))).toEqual(park)
        expect(parkOfQuestion({ stepKey: "note", reason: "x" })).toBeNull()
        const payload = parkPayloadOf({ workspaceId: "ws", runId: "run" }, park)
        expect(payload).toEqual({ workspaceId: "ws", runId: "run", stepKey: "poll[r2]", repeats: 2, answered: -1 })
        expect(isParkPayload(payload)).toBe(true)
        expect(isParkPayload({ answered: 0 })).toBe(false)
        expect(parkMatches(park, payload)).toBe(true)
        expect(parkMatches(park, { ...payload, repeats: 3 })).toBe(false)
    })
})
