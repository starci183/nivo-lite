import {
    agentConnectionsPort,
    agentRuns,
    parkedRunsPort,
    agentKnowledgePort,
    installationPort,
    membersPort,
    rightsPort,
} from "./ports"

describe("the ports of the platform module", () => {
    it("are registered under ids of the platform, one each", () => {
        expect(installationPort.id).toBe("platform.installation")
        expect(membersPort.id).toBe("platform.members")
        expect(rightsPort.id).toBe("platform.rights")
        expect(parkedRunsPort.id).toBe("platform.parked-runs")
        expect(agentRuns.id).toBe("engine.entity.agent.run")
        expect(agentConnectionsPort.id).toBe("platform.agent-connections")
        expect(agentKnowledgePort.id).toBe("platform.agent-knowledge")
    })
})
