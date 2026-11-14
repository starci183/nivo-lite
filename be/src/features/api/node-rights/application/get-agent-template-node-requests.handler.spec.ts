import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { NodeRightRollupsService, type TemplateNodeRequests } from "@modules/domain/node-right-rollups"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { GetAgentTemplateNodeRequestsHandler } from "./get-agent-template-node-requests.handler"
import { GetAgentTemplateNodeRequestsQuery } from "./get-agent-template-node-requests.query"

const ANSWER = builder<TemplateNodeRequests>({
    templateId: "sales.consult",
    version: 7,
    rights: [],
    count: 0,
    askCount: 0,
})

const build = async () => {
    const rollups = mock<NodeRightRollupsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GetAgentTemplateNodeRequestsHandler,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: NodeRightRollupsService, useValue: rollups },
        ],
    }).compile()
    return { handler: moduleRef.get(GetAgentTemplateNodeRequestsHandler), rollups }
}

describe("GetAgentTemplateNodeRequestsHandler", () => {
    it("asks the roll-ups as the signed-in person, for the named template and version, the newest when none is named", async () => {
        const { handler, rollups } = await build()
        const answer = ANSWER()
        rollups.templateRequests.mockResolvedValue(answer)
        const principal = { id: "user-1", role: "authenticated" as const }
        const request = { workspaceId: "ws-1", templateId: "sales.consult" }

        await expect(
            handler.execute(new GetAgentTemplateNodeRequestsQuery({ request: { ...request, version: 6 }, principal })),
        ).resolves.toBe(answer)
        await handler.execute(new GetAgentTemplateNodeRequestsQuery({ request, principal }))

        const actor = { principalId: "user-1", workspaceId: "ws-1" }
        expect(rollups.templateRequests).toHaveBeenNthCalledWith(1, actor, "sales.consult", 6)
        expect(rollups.templateRequests).toHaveBeenNthCalledWith(2, actor, "sales.consult", undefined)
    })
})
