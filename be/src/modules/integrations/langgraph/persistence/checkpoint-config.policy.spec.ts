import { Test } from "@nestjs/testing"
import { LanggraphErrorCode } from "../errors/langgraph.error"
import { addressOf, keyOf, pathOf, plainRecordOf, required } from "./checkpoint-config.policy"

/** The members of the subject under test. */
interface Subject {
    readonly addressOf: typeof addressOf
    readonly keyOf: typeof keyOf
    readonly pathOf: typeof pathOf
    readonly plainRecordOf: typeof plainRecordOf
    readonly required: typeof required
}

const SUBJECT = Symbol("checkpoint-config.policy")
const NUL = String.fromCodePoint(0)

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
        providers: [{ provide: SUBJECT, useValue: { addressOf, keyOf, pathOf, plainRecordOf, required } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("checkpoint-config.policy", () => {
    it("reads the workspace, the thread, the namespace, the checkpoint and the fence of a call", async () => {
        const subject = await build()

        const address = subject.addressOf({
            workspace_id: "w-1",
            thread_id: "t-1",
            checkpoint_ns: "child",
            checkpoint_id: "c-1",
            fence: 7,
            other: true,
        })

        expect(address).toEqual({
            workspaceId: "w-1",
            threadId: "t-1",
            namespace: "child",
            checkpointId: "c-1",
            fence: 7,
        })
    })

    it("reads what the caller did not name as null, an empty id included, and keeps an empty namespace", async () => {
        const subject = await build()

        expect(subject.addressOf(undefined)).toEqual({
            workspaceId: null,
            threadId: null,
            namespace: null,
            checkpointId: null,
            fence: null,
        })
        expect(subject.addressOf({ thread_id: "", checkpoint_id: null, checkpoint_ns: "", fence: null })).toEqual({
            workspaceId: null,
            threadId: null,
            namespace: "",
            checkpointId: null,
            fence: null,
        })
        expect(subject.addressOf({ fence: 0 }).fence).toBe(0)
    })

    it.each([
        ["thread_id", { thread_id: 12 }],
        ["thread_id", { thread_id: "t".repeat(201) }],
        ["workspace_id", { workspace_id: {} }],
        ["checkpoint_id", { checkpoint_id: ["c"] }],
        ["checkpoint_ns", { checkpoint_ns: 4 }],
        ["checkpoint_ns", { checkpoint_ns: "n".repeat(2001) }],
        ["fence", { fence: "3" }],
        ["fence", { fence: -1 }],
        ["fence", { fence: 1.5 }],
        ["fence", { fence: Number.NaN }],
    ])("refuses a %s a row cannot store", async (key, configurable) => {
        const subject = await build()

        expect(thrownBy(() => subject.addressOf(configurable))).toMatchObject({
            code: LanggraphErrorCode.CheckpointKeyInvalid,
            params: { key },
        })
    })
})

describe("checkpoint-config.policy: keys and metadata", () => {
    it("reads a key of 1 to 200 characters and a path of 0 to 2000", async () => {
        const subject = await build()

        expect(subject.keyOf("k".repeat(200), "task_id")).toHaveLength(200)
        expect(subject.pathOf("", "task_path")).toBe("")
        expect(thrownBy(() => subject.keyOf("", "task_id"))).toMatchObject({
            code: LanggraphErrorCode.CheckpointKeyInvalid,
            params: { key: "task_id" },
        })
        expect(thrownBy(() => subject.pathOf(undefined, "task_path"))).toMatchObject({
            code: LanggraphErrorCode.CheckpointKeyInvalid,
            params: { key: "task_path" },
        })
    })

    it("refuses a call that leaves out a part it cannot go without", async () => {
        const subject = await build()

        expect(subject.required("w-1", "workspace_id")).toBe("w-1")
        expect(thrownBy(() => subject.required(null, "workspace_id"))).toMatchObject({
            code: LanggraphErrorCode.CheckpointScopeMissing,
            params: { key: "workspace_id" },
        })
    })

    it("makes metadata the plain JSON a jsonb column stores: no undefined, no NUL, never a list", async () => {
        const subject = await build()

        expect(
            subject.plainRecordOf({
                source: "loop",
                step: 1,
                parents: {},
                note: `a${NUL}b`,
                gone: undefined,
                [`k${NUL}`]: [`x${NUL}`, 2, undefined],
                at: new Date(0),
                odd: Number.NaN,
            }),
        ).toEqual({
            source: "loop",
            step: 1,
            parents: {},
            note: "ab",
            k: ["x", 2, null],
            at: "1970-01-01T00:00:00.000Z",
            odd: null,
        })
        expect(subject.plainRecordOf(undefined)).toEqual({})
        expect(subject.plainRecordOf(["a"])).toEqual({})
        expect(subject.plainRecordOf("text")).toEqual({})
    })
})
