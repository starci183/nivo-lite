import { NOW, returnedRows, runOfRaw } from "./lead-action-projection"

describe("lead action projection", () => {
    it("names the database instant", () => {
        expect(NOW()).toBe("now()")
    })

    it("keeps only the rows a write answered", () => {
        expect(returnedRows([{ id: "run-1" }, null, "text"])).toEqual([{ id: "run-1" }])
        expect(returnedRows(undefined)).toEqual([])
    })

    it("reads the run of the first returned row from its column names", () => {
        const row = {
            id: "run-1",
            workspace_id: "ws-1",
            requested_by: "user-1",
            action: "create",
            input: { need: "tea" },
            locale: "vi",
            status: "running",
            result: null,
            error_code: null,
        }

        expect(runOfRaw([row])).toEqual({
            id: "run-1",
            workspaceId: "ws-1",
            requestedBy: "user-1",
            action: "create",
            input: { need: "tea" },
            locale: "vi",
            status: "running",
            result: null,
            errorCode: null,
        })
    })

    it("answers nothing when the write answered no row", () => {
        expect(runOfRaw([])).toBeUndefined()
    })
})
