import { Test } from "@nestjs/testing"
import { McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import type { NativeConnectorManifest } from "../mcp-gateway.contracts"
import { RoutedNativeAdapter } from "./routed-native.adapter"
import type { NativeToolHandler } from "./routed-native.adapter"

const MANIFEST: NativeConnectorManifest = {
    key: "probe",
    name: "Probe",
    kind: "native",
    contractVersion: "probe@1",
    tools: [],
}
const CALLER = { agentId: "a1", conversationId: null }

class Probe extends RoutedNativeAdapter {
    readonly manifest: NativeConnectorManifest = MANIFEST
    protected readonly handlers = new Map<string, NativeToolHandler>([
        ["echo", (workspaceId, args) => Promise.resolve({ workspaceId, args })],
    ])
}

const build = async (): Promise<Probe> => {
    const moduleRef = await Test.createTestingModule({ providers: [Probe] }).compile()
    return moduleRef.get(Probe)
}

describe("RoutedNativeAdapter", () => {
    it("runs the handler of the tool named, for the workspace and with the arguments of the call", async () => {
        const probe = await build()

        await expect(probe.invoke("w1", "echo", { a: 1 }, CALLER)).resolves.toEqual({
            workspaceId: "w1",
            args: { a: 1 },
        })
    })

    it("refuses a tool the connector does not have, as an unknown tool", async () => {
        const probe = await build()

        await expect(probe.invoke("w1", "nope", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "nope" },
        })
    })
})
