import { iterationKeyOf } from "@nivo-lite/agent-sdk/node"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { previousRoundOf, stepsOfRun } from "./agent-graph-step-memory.service"

/** The step key of a body node in round r of the until loop `talk`. */
const roundKey = (round: number, node: string): string => iterationKeyOf("talk", `r${String(round)}`, node)

/** A view of the run with three rounds of the body node `reply` done and `ask` done in round 3. */
const VIEW = stepViewOf({
    earlier: {
        [roundKey(1, "reply")]: { output: { said: "one" } },
        [roundKey(2, "reply")]: { output: { said: "two" } },
        [roundKey(3, "ask")]: { output: { asked: true } },
        before: { output: { started: true } },
    },
})

/** The input of a body node in round r. */
const inRound = (round: number) => ({
    item: { value: { $round: round }, index: round - 1, key: `r${String(round)}` },
    loop: { nodeKey: "talk", index: round - 1, items: [] },
})

describe("previousRoundOf: the body steps of the round before (ruling R13)", () => {
    it("inside round 3 reads round 2's body steps only, by node key, never round 1's or round 3's", () => {
        const previous = previousRoundOf(VIEW, "v-1", inRound(3))

        expect(Object.keys(previous)).toEqual(["reply"])
        expect(previous.reply?.output).toEqual({ said: "two" })
    })

    it("is empty in round 1 and outside a loop body", () => {
        expect(previousRoundOf(VIEW, "v-1", inRound(1))).toEqual({})
        expect(previousRoundOf(VIEW, "v-1")).toEqual({})
    })

    it("leaves `steps` as it was: inside round 3 a body node sees round 3's own step only", () => {
        const steps = stepsOfRun(VIEW, "v-1", inRound(3))

        expect(Object.keys(steps).sort()).toEqual(["ask", "before"])
    })
})
