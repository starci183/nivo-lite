import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import type { ChannelProfilePort } from "@modules/domain/provider-registry"
import { ChannelProfileRegistryService } from "@modules/domain/provider-registry"
import { ToolsErrorCode } from "@modules/domain/tools"
import { CUSTOMER_PROFILE_MANIFEST, CustomerProfileNativeService } from "./customer-profile-native.service"

const CALLER = { agentId: "agent-1", conversationId: "route-1" }

const build = (port?: ChannelProfilePort) => {
    const connections = mock<ConnectionsService>()
    connections.get.mockResolvedValue({ id: "conn-1", provider: "zalo_oa" } as ConnectionRecord)
    const profiles = new (class extends ChannelProfileRegistryService {})()
    if (port !== undefined) profiles.register(port)
    return { connections, service: new CustomerProfileNativeService(connections, profiles) }
}

const portOf = (answer: Awaited<ReturnType<ChannelProfilePort["profileOf"]>>): ChannelProfilePort & { profileOf: jest.Mock } => ({
    provider: "zalo_oa",
    profileOf: jest.fn().mockResolvedValue(answer),
})

describe("CustomerProfileNativeService", () => {
    it("is one read of the generic tool family, named for the person", () => {
        expect(CUSTOMER_PROFILE_MANIFEST.namespace).toBe("nivo.tool.customer.profile")
        expect(CUSTOMER_PROFILE_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.defaultMode])).toEqual([["get", "read", "auto"]])
    })

    it("asks the profile port of the provider of the account, with the connection and the person's id on the channel", async () => {
        const port = portOf({ name: "Lan", picture: "https://x.test/lan.jpg" })
        const { service, connections } = build(port)

        await expect(service.invoke("ws-1", "get", { accountId: "conn-1", personId: "u-1" }, CALLER)).resolves.toEqual({
            name: "Lan",
            picture: "https://x.test/lan.jpg",
        })

        expect(connections.get).toHaveBeenCalledWith("ws-1", "conn-1")
        expect(port.profileOf).toHaveBeenCalledWith("conn-1", "u-1")
    })

    it("answers empty texts when the channel will not say or its provider registered no profile read", async () => {
        const silent = build(portOf(null))
        await expect(silent.service.invoke("ws-1", "get", { accountId: "conn-1", personId: "u-1" }, CALLER)).resolves.toEqual({ name: "", picture: "" })
        const none = build()
        await expect(none.service.invoke("ws-1", "get", { accountId: "conn-1", personId: "u-1" }, CALLER)).resolves.toEqual({ name: "", picture: "" })
    })

    it("refuses an account the workspace does not have, and arguments that name more than the account and the person", async () => {
        const { service, connections } = build(portOf(null))
        connections.get.mockRejectedValue(new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: "conn-9" } }))

        await expect(service.invoke("ws-1", "get", { accountId: "conn-9", personId: "u-1" }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "not_found" },
        })
        await expect(service.invoke("ws-1", "get", { accountId: "conn-1", personId: "u-1", contactId: "c-1" }, CALLER)).rejects.toBeDefined()
        await expect(service.invoke("ws-1", "other", {}, CALLER)).rejects.toBeDefined()
    })
})
