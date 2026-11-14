import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { NodeRightRollupsService, type AgentNodeRights } from "@modules/domain/node-right-rollups"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { GetAgentNodeRightsHandler } from "./get-agent-node-rights.handler"
import { GetAgentNodeRightsQuery } from "./get-agent-node-rights.query"

const ANSWER = builder<AgentNodeRights>({ agentId: "id-1", accounts: [], rows: [] })

const build = async () => {
    const rollups = mock<NodeRightRollupsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GetAgentNodeRightsHandler,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: NodeRightRollupsService, useValue: rollups },
        ],
    }).compile()
    return { handler: moduleRef.get(GetAgentNodeRightsHandler), rollups }
}

describe("GetAgentNodeRightsHandler", () => {
    it("asks the roll-ups as the signed-in person in the request's workspace, for the named agentId", async () => {
        const { handler, rollups } = await build()
        const answer = ANSWER()
        rollups.agentRights.mockResolvedValue(answer)

        await expect(
            handler.execute(
                new GetAgentNodeRightsQuery({
                    request: { workspaceId: "ws-1", agentId: "id-1" },
                    principal: { id: "user-1", role: "authenticated" },
                }),
            ),
        ).resolves.toBe(answer)

        expect(rollups.agentRights).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" }, "id-1")
    })
})
