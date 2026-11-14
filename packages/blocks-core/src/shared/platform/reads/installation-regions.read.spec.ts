import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { CONNECTIONS_VIEW, KNOWLEDGE_NONE, KNOWLEDGE_VIEW } from "../fixtures/platform.fixtures"
import { agentConnectionsPort, agentKnowledgePort, coreReadsPort } from "../ports"
import { agentTabPath, installationConnectionsRead, installationKnowledgeRead } from "./installation-regions.read"

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-04T11:30:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const INSTALLATION = "00000000-0000-4000-8000-000000000001"
const AGENT = "00000000-0000-4000-8000-000000000002"
const GIVEN = { installation: INSTALLATION, module: "accounting" }

/** A provider whose core reads know the agent of the installation (or none), and whose regions answer for the agent asked. */
const providerOf = (hasAgent: boolean, asked: Array<string>): PortProvider => ({
    implementationOf: (port) => {
        if (port.id === coreReadsPort.id) return { agentOf: () => Promise.resolve(hasAgent ? AGENT : null) }
        if (port.id === agentConnectionsPort.id)
            return {
                of: (agent: string) => {
                    asked.push(agent)
                    return Promise.resolve(CONNECTIONS_VIEW)
                },
            }
        if (port.id === agentKnowledgePort.id)
            return {
                of: (agent: string) => {
                    asked.push(agent)
                    return Promise.resolve(KNOWLEDGE_VIEW)
                },
            }
        return undefined
    },
})

describe("the installation regions", () => {
    it("builds the path of a tab of the agent", () => {
        expect(agentTabPath("accounting", "i1", "connections")).toBe("/agents/accounting/i1/connections")
    })

    it("gives the providers attached to the agent of the installation with the link to its rights tab", async () => {
        const asked: Array<string> = []
        const result = await installationConnectionsRead.execute?.(providerOf(true, asked), GIVEN, CONTEXT)
        expect(result).toMatchObject({
            ok: true,
            data: {
                label: CONNECTIONS_VIEW.label,
                rightsLabel: CONNECTIONS_VIEW.rightsLabel,
                rows: CONNECTIONS_VIEW.rows,
                rightsHref: `/agents/accounting/${INSTALLATION}/connections`,
            },
        })
        expect(asked).toEqual([AGENT])
    })

    it("lists no connection for an installation with no agent", async () => {
        const result = await installationConnectionsRead.execute?.(providerOf(false, []), GIVEN, CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { rows: [] } })
    })

    it("gives what the agent knows, its gaps linking to the Knowledge tab", async () => {
        const result = await installationKnowledgeRead.execute?.(providerOf(true, []), GIVEN, CONTEXT)
        const href = `/agents/accounting/${INSTALLATION}/knowledge`
        expect(result).toMatchObject({ ok: true, data: { openHref: href, gaps: { openHref: href } } })
    })

    it("keeps no gaps card for an agent with no gap or no installation", async () => {
        expect(KNOWLEDGE_NONE.gaps).toBeNull()
        const result = await installationKnowledgeRead.execute?.(providerOf(false, []), GIVEN, CONTEXT)
        expect(result).toMatchObject({ ok: true, data: { gaps: null, publicTitle: "" } })
    })

    it("is read with the platform view permission and refuses a call without an installation", async () => {
        expect(installationConnectionsRead.permission).toBe("platform.view")
        expect(installationKnowledgeRead.permission).toBe("platform.view")
        await expect(
            installationKnowledgeRead.execute?.(providerOf(true, []), { module: "accounting" }, CONTEXT),
        ).resolves.toMatchObject({ ok: false })
    })
})
