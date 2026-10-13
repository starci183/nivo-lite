import { builder } from "@starci/jest-preset"
import type { SetWorkspaceStatusResult } from "../../application/set-workspace-status.contracts"
import { toSetWorkspaceStatusRequest, toSetWorkspaceStatusResponse } from "./set-workspace-status.mapper"

const resultOf = builder<SetWorkspaceStatusResult>({ status: "past_due" })

describe("set-workspace-status mapper", () => {
    it("adds the workspace to the requested status", () => {
        expect(toSetWorkspaceStatusRequest("workspace-1", { status: "past_due" })).toEqual({
            workspaceId: "workspace-1",
            status: "past_due",
        })
    })

    it("returns the applied status unchanged", () => {
        const result = resultOf()

        expect(toSetWorkspaceStatusResponse(result)).toBe(result)
        expect(toSetWorkspaceStatusResponse(result)).toEqual({ status: "past_due" })
    })
})
