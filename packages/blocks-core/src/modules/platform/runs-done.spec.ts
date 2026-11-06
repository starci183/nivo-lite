import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { doneRowOf } from "./runs-done"

const run = (data: Readonly<Record<string, unknown>>): RecordRow => ({
    id: "r1",
    workspaceId: "w1",
    version: "1",
    createdAt: "2026-11-04T10:00:00.000Z",
    updatedAt: "2026-11-04T10:00:00.000Z",
    data,
})

describe("doneRowOf", () => {
    it("heads the row with the trigger and details it with the instant the run ended", () => {
        expect(doneRowOf(run({ trigger: "tag", endedAt: "2026-11-04T11:00:00.000Z" }))).toEqual({
            id: "r1",
            title: "tag",
            description: "2026-11-04T11:00:00.000Z",
            href: "",
        })
    })

    it("leaves a field the engine did not give empty", () => {
        expect(doneRowOf(run({ trigger: null }))).toEqual({ id: "r1", title: "", description: "", href: "" })
    })
})
