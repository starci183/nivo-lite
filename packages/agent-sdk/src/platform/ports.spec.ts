import {
    agentConnectionsPort,
    agentKnowledgePort,
    coreReadsPort,
    customerMessagesPort,
    installationPort,
    membersPort,
    parkedRunsPort,
    rightsPort,
    routeHoldsPort,
} from "./index"

describe("the platform ports", () => {
    it("are registered under ids of the platform, one each", () => {
        expect(installationPort.id).toBe("platform.installation")
        expect(membersPort.id).toBe("platform.members")
        expect(rightsPort.id).toBe("platform.rights")
        expect(parkedRunsPort.id).toBe("platform.parked-runs")
        expect(coreReadsPort.id).toBe("platform.core")
        expect(customerMessagesPort.id).toBe("platform.customer-messages")
        expect(routeHoldsPort.id).toBe("platform.route-holds")
        expect(agentConnectionsPort.id).toBe("platform.agent-connections")
        expect(agentKnowledgePort.id).toBe("platform.agent-knowledge")
    })
})
