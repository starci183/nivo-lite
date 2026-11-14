import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { NodeRightRollupsService, type ProviderRightHolders } from "@modules/domain/node-right-rollups"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { GetProviderRightHoldersHandler } from "./get-provider-right-holders.handler"
import { GetProviderRightHoldersQuery } from "./get-provider-right-holders.query"

const ANSWER = builder<ProviderRightHolders>({
    connectionId: "id-1",
    provider: "sepay",
    tools: [],
    counts: { all: 0, held: 0, unheld: 0, writes: 0 },
    screens: [],
    triggers: [],
})

const build = async () => {
    const rollups = mock<NodeRightRollupsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GetProviderRightHoldersHandler,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: NodeRightRollupsService, useValue: rollups },
        ],
    }).compile()
    return { handler: moduleRef.get(GetProviderRightHoldersHandler), rollups }
}

describe("GetProviderRightHoldersHandler", () => {
    it("asks the roll-ups as the signed-in person in the request's workspace, for the named connectionId", async () => {
        const { handler, rollups } = await build()
        const answer = ANSWER()
        rollups.providerHolders.mockResolvedValue(answer)

        await expect(
            handler.execute(
                new GetProviderRightHoldersQuery({
                    request: { workspaceId: "ws-1", connectionId: "id-1" },
                    principal: { id: "user-1", role: "authenticated" },
                }),
            ),
        ).resolves.toBe(answer)

        expect(rollups.providerHolders).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" }, "id-1")
    })
})
