import { RUN_STATES, runStateLook } from "./run-state"

describe("runStateLook", () => {
    it("tells every run state with its own words key", () => {
        const keys = RUN_STATES.map((state) => runStateLook(state).key)
        expect(new Set(keys).size).toBe(RUN_STATES.length)
        expect(keys).toEqual(["runStateRunning", "runStateWaiting", "runStateParked", "runStateFailed", "runStateDone", "runStateCancelled"])
    })

    it("asks for a person on a waiting, parked or failed state only", () => {
        expect(RUN_STATES.filter((state) => runStateLook(state).isAttention)).toEqual(["waiting", "parked", "failed"])
    })

    it("pairs each state with a tone and a presentation state", () => {
        expect(runStateLook("running")).toMatchObject({ tone: "info", presentation: "informative" })
        expect(runStateLook("waiting")).toMatchObject({ tone: "warning", presentation: "pending" })
        expect(runStateLook("parked")).toMatchObject({ tone: "warning", presentation: "cautionary" })
        expect(runStateLook("failed")).toMatchObject({ tone: "danger", presentation: "negative" })
        expect(runStateLook("done")).toMatchObject({ tone: "success", presentation: "affirmative" })
        expect(runStateLook("cancelled")).toMatchObject({ tone: "neutral", presentation: "neutral", isAttention: false })
    })
})
