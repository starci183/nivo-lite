import { Test } from "@nestjs/testing"
import { ToolsErrorCode } from "../errors/tools.error"
import type { ToolManifest } from "../tools.contracts"
import { RoutedToolFamily } from "./routed-tool-family"
import type { ToolHandler } from "./routed-tool-family"

const MANIFEST: ToolManifest = {
    key: "probe",
    name: "Probe",
    contractVersion: "probe@1",
    tools: [],
}
const CALLER = { agentId: "a1", conversationId: null }

class Probe extends RoutedToolFamily {
    readonly manifest: ToolManifest = MANIFEST
    protected readonly handlers = new Map<string, ToolHandler>([
        ["echo", (workspaceId, args) => Promise.resolve({ workspaceId, args })],
    ])
}

const build = async (): Promise<Probe> => {
    const moduleRef = await Test.createTestingModule({ providers: [Probe] }).compile()
    return moduleRef.get(Probe)
}

describe("RoutedToolFamily", () => {
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
            code: ToolsErrorCode.UnknownTool,
            params: { tool: "nope" },
        })
    })
})
