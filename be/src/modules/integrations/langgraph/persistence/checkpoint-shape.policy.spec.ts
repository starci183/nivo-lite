import { Test } from "@nestjs/testing"
import { LanggraphErrorCode } from "../errors/langgraph.error"
import { checkpointOf, metadataOf } from "./checkpoint-shape.policy"

/** The members of the subject under test. */
interface Subject {
    readonly checkpointOf: typeof checkpointOf
    readonly metadataOf: typeof metadataOf
}

const SUBJECT = Symbol("checkpoint-shape.policy")
const UNREADABLE = { code: LanggraphErrorCode.ThreadUnreadable, params: { thread: "t-1" } }

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { checkpointOf, metadataOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("checkpoint-shape.policy", () => {
    it("reads a stored checkpoint back with its version maps and no channel values", async () => {
        const subject = await build()
        const stored = {
            v: 4,
            id: "c-1",
            ts: "2026-11-10T00:00:00.000Z",
            channel_values: { left: 1 },
            channel_versions: { steps: 2 },
            versions_seen: { ask: { steps: 1 } },
        }

        expect(subject.checkpointOf(stored, "t-1")).toEqual({ ...stored, channel_values: {} })
        expect(subject.checkpointOf({ v: 1, id: "c-0", ts: "2024-04-19T17:19:07.952Z" }, "t-1")).toEqual({
            v: 1,
            id: "c-0",
            ts: "2024-04-19T17:19:07.952Z",
            channel_values: {},
            channel_versions: {},
            versions_seen: {},
        })
    })

    it.each([
        ["null", null],
        ["a list", [1]],
        ["a text", "checkpoint"],
        ["no format number", { id: "c-1", ts: "now" }],
        ["no id", { v: 4, ts: "now" }],
        ["no time", { v: 4, id: "c-1" }],
        ["versions that are a list", { v: 4, id: "c-1", ts: "now", channel_versions: [1] }],
        ["seen versions that are a text", { v: 4, id: "c-1", ts: "now", versions_seen: "x" }],
    ])("refuses %s as a checkpoint", async (_name, stored) => {
        const subject = await build()

        expect(thrownBy(() => subject.checkpointOf(stored, "t-1"))).toMatchObject(UNREADABLE)
    })

    it("reads stored metadata back as it was written, every other key kept", async () => {
        const subject = await build()

        expect(subject.metadataOf({ source: "loop", step: 2, parents: { "": "c-0" }, writer: "ask" }, "t-1")).toEqual({
            source: "loop",
            step: 2,
            parents: { "": "c-0" },
            writer: "ask",
        })
        expect(subject.metadataOf({ source: "input", step: -1 }, "t-1")).toEqual({
            source: "input",
            step: -1,
            parents: {},
        })
        expect(
            subject.metadataOf({ source: "fork", step: 0, parents: { "": 4, child: "c-1" } }, "t-1").parents,
        ).toEqual({ child: "c-1" })
    })

    it.each([
        ["no source", { step: 0, parents: {} }],
        ["an unknown source", { source: "import", step: 0, parents: {} }],
        ["no step", { source: "loop", parents: {} }],
    ])("refuses metadata with %s", async (_name, stored) => {
        const subject = await build()

        expect(thrownBy(() => subject.metadataOf(stored, "t-1"))).toMatchObject(UNREADABLE)
    })
})
