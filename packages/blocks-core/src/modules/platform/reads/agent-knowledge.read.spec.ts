import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { KNOWLEDGE_VIEW } from "../fixtures/platform.fixtures"
import { agentKnowledgePort } from "../ports"
import { agentKnowledgeRead } from "./agent-knowledge.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

describe("platform.agent-knowledge", () => {
    it("gives the knowledge the port finds for the agent", async () => {
        const provider: PortProvider = {
            implementationOf: (port) =>
                port.id === agentKnowledgePort.id ? { of: () => Promise.resolve(KNOWLEDGE_VIEW) } : undefined,
        }
        await expect(agentKnowledgeRead.execute?.(provider, { agent: "sales" }, CONTEXT)).resolves.toEqual({
            ok: true,
            data: KNOWLEDGE_VIEW,
        })
    })

    it("is read with the platform view permission", () => {
        expect(agentKnowledgeRead.permission).toBe("platform.view")
    })
})
