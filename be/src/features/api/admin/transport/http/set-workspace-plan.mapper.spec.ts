import { builder } from "@starci/jest-preset"
import type { SetWorkspacePlanResult } from "../../application/set-workspace-plan.contracts"
import { toSetWorkspacePlanRequest, toSetWorkspacePlanResponse } from "./set-workspace-plan.mapper"

const resultOf = builder<SetWorkspacePlanResult>({ planCode: "pro", creditsLimit: 500 })

describe("set-workspace-plan mapper", () => {
    it("adds the workspace and preserves an explicit credits allowance", () => {
        expect(toSetWorkspacePlanRequest("workspace-1", { planCode: "pro", creditsLimit: 500 })).toEqual({
            workspaceId: "workspace-1",
            planCode: "pro",
            creditsLimit: 500,
        })
    })

    it("preserves null when clearing the workspace allowance", () => {
        expect(toSetWorkspacePlanRequest("workspace-2", { planCode: "starter", creditsLimit: null })).toEqual({
            workspaceId: "workspace-2",
            planCode: "starter",
            creditsLimit: null,
        })
    })

    it("returns the selected plan unchanged", () => {
        const result = resultOf()

        expect(toSetWorkspacePlanResponse(result)).toBe(result)
        expect(toSetWorkspacePlanResponse(result)).toEqual({ planCode: "pro", creditsLimit: 500 })
    })
})
