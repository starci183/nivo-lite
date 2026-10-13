import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionsService } from "@modules/domain/connections"
import { DataHubService } from "./data-hub.service"

describe("DataHubService", () => {
    const build = async () => {
        const connections = mock<ConnectionsService>()
        const moduleRef = await Test.createTestingModule({
            providers: [DataHubService, { provide: ConnectionsService, useValue: connections }],
        }).compile()
        return { service: moduleRef.get(DataHubService), connections }
    }

    it("answers null when the connection has no stored credential", async () => {
        const { service, connections } = await build()
        connections.readSecret.mockResolvedValue(null)

        await expect(service.credentialOf("c-1")).resolves.toBeNull()
    })

    it("answers the opened credential text", async () => {
        const { service, connections } = await build()
        connections.readSecret.mockResolvedValue({ plain: '{"host":"db"}', webhookSecret: "" })

        await expect(service.credentialOf("c-1")).resolves.toBe('{"host":"db"}')
    })
})
