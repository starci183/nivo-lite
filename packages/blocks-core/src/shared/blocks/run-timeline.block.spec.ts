import {
    RUN_DONE,
    RUN_PARKED,
    RUN_WAITING,
    runTimelineFixtureProps,
    runTimelineFixtures,
} from "../fixtures/run-timeline.fixtures"
import { runStepsOf } from "../rows/run-timeline"
import { runView } from "../rows/run-timeline-view"
import { runTimelineBlock } from "./run-timeline.block"

const WORD = { key: "word" }
const CONTEXT = { locale: "vi", currency: "VND", timeZone: "UTC" }
const accepts = (props: unknown): boolean => runTimelineBlock.props.safeParse(props).success

describe("runTimelineBlock", () => {
    it("is the core.run-timeline block, with no children and no param prop", () => {
        expect(runTimelineBlock.id).toBe("core.run-timeline")
        expect(runTimelineBlock.children).toBe(false)
        expect(runTimelineBlock.params).toBeUndefined()
        expect(Object.keys(runTimelineBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("names a required run read of one record and an optional resume action", () => {
        expect(runTimelineBlock.slots).toEqual({
            run: { kind: "read", shape: "record", required: true },
            resume: { kind: "action", required: false },
        })
    })

    it("takes a label, with the idle words optional", () => {
        expect(accepts({ label: WORD })).toBe(true)
        expect(accepts({ label: WORD, idle: WORD })).toBe(true)
        expect(accepts(runTimelineFixtureProps)).toBe(true)
    })

    it("refuses a missing label and a label that is no words", () => {
        expect(accepts({})).toBe(false)
        expect(accepts({ label: 3 })).toBe(false)
    })
})

describe("runTimelineFixtures", () => {
    it("holds a finished run, a run waiting for approval, a parked run and every other status", () => {
        expect(Object.keys(runTimelineFixtures)).toEqual([
            "ready",
            "waiting",
            "parked",
            "empty",
            "error",
            "loading",
            "forbidden",
        ])
    })

    it("holds runs the read shape accepts", () => {
        expect([RUN_DONE, RUN_WAITING, RUN_PARKED].every((run) => runView.safeParse(run).success)).toBe(true)
    })

    it("lets the waiting run link to its approval and the parked run offer the one command to run it again", () => {
        expect(runStepsOf(RUN_WAITING, CONTEXT).map((row) => row.approvalPath)).toEqual([null, null, "/approvals/ap-1"])
        expect(runStepsOf(RUN_PARKED, CONTEXT).map((row) => row.canResume)).toEqual([false, true])
        expect(runStepsOf(RUN_DONE, CONTEXT).some((row) => row.canResume)).toBe(false)
    })
})
