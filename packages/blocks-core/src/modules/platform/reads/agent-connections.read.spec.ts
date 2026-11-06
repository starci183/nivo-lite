import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { CONNECTIONS_VIEW } from "../fixtures/platform.fixtures"
import { agentConnectionsPort } from "../ports"
import { agentConnectionsRead } from "./agent-connections.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

describe("platform.agent-connections", () => {
    it("gives the connections the port finds for the agent", async () => {
        const asked: Array<string> = []
        const provider: PortProvider = {
            implementationOf: (port) =>
                port.id === agentConnectionsPort.id
                    ? {
                          of: (agent: string) => {
                              asked.push(agent)
                              return Promise.resolve(CONNECTIONS_VIEW)
                          },
                      }
                    : undefined,
        }
        await expect(agentConnectionsRead.execute?.(provider, { agent: "sales" }, CONTEXT)).resolves.toEqual({
            ok: true,
            data: CONNECTIONS_VIEW,
        })
        expect(asked).toEqual(["sales"])
    })

    it("refuses a call that names no agent, and is read with the platform view permission", async () => {
        const provider: PortProvider = { implementationOf: () => undefined }
        await expect(agentConnectionsRead.execute?.(provider, {}, CONTEXT)).resolves.toMatchObject({ ok: false })
        expect(agentConnectionsRead.permission).toBe("platform.view")
    })
})
