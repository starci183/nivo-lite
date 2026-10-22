import { Test } from "@nestjs/testing"
import { UnassignedApprovalAgentOwners } from "./unassigned-agent-owners.service"

describe("UnassignedApprovalAgentOwners", () => {
    it("names nobody for any agent, so the request falls to the workspace owner", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnassignedApprovalAgentOwners] }).compile()

        await expect(moduleRef.get(UnassignedApprovalAgentOwners).ownerOf()).resolves.toEqual({
            ownerMemberId: null,
            fallbackMemberId: null,
        })
    })
})
