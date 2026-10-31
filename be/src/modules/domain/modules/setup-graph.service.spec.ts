import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { SETUP_GRAPH } from "./modules.decorators"
import type { SetupApplier, SetupGraphPort } from "./modules.port"
import { SetupGraphService } from "./setup-graph.service"

const APPLIER: SetupApplier = {
    workspaceId: "ws-1",
    principalId: "user-1",
    installationId: "inst-1",
    contextVersionId: "cv-1",
}

const build = async (port: Partial<SetupGraphPort>) => {
    const graph = mock<SetupGraphPort>(port)
    const moduleRef = await Test.createTestingModule({
        providers: [SetupGraphService, { provide: SETUP_GRAPH, useValue: graph }],
    }).compile()
    return { service: moduleRef.get(SetupGraphService), graph }
}

const buildWithoutGraph = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [SetupGraphService, { provide: SETUP_GRAPH, useValue: null }],
    }).compile()
    return { service: moduleRef.get(SetupGraphService) }
}

describe("SetupGraphService with a graph", () => {
    it("names the first vague place, or null when the graph has none", async () => {
        const vague = await build({ firstGap: jest.fn().mockResolvedValue("boundary") })
        const whole = await build({ firstGap: jest.fn().mockResolvedValue("") })

        await expect(vague.service.gapOf("ws-1", "inst-1")).resolves.toBe("boundary")
        await expect(whole.service.gapOf("ws-1", "inst-1")).resolves.toBeNull()
        expect(vague.graph.firstGap).toHaveBeenCalledWith("ws-1", "inst-1")
    })

    it("refuses the apply while the flow is vague, and lets a whole one through", async () => {
        const vague = await build({ firstGap: jest.fn().mockResolvedValue("on_timeout") })
        const whole = await build({ firstGap: jest.fn().mockResolvedValue("") })

        await expect(vague.service.requireWhole("ws-1", "inst-1")).rejects.toMatchObject({
            code: ModulesErrorCode.GraphGapsOpen,
        })
        await expect(vague.service.requireWhole("ws-1", "inst-1")).rejects.toBeInstanceOf(ModulesError)
        await expect(whole.service.requireWhole("ws-1", "inst-1")).resolves.toBeUndefined()
    })

    it("hands the publish and the name lookup to the graph, a missing seat reading as null", async () => {
        const found = await build({
            publish: jest.fn().mockResolvedValue(undefined),
            seatNamed: jest.fn().mockResolvedValue("nam"),
        })
        const lost = await build({ seatNamed: jest.fn().mockResolvedValue("") })

        await found.service.publish(APPLIER)

        expect(found.graph.publish).toHaveBeenCalledWith(APPLIER)
        await expect(found.service.seatNamed("ws-1", "Nam")).resolves.toBe("nam")
        await expect(lost.service.seatNamed("ws-1", "Nobody")).resolves.toBeNull()
    })
})

describe("SetupGraphService with no graph", () => {
    it("answers as if the flow were whole, finds no seat, and publishes nothing", async () => {
        const { service } = await buildWithoutGraph()

        await expect(service.gapOf("ws-1", "inst-1")).resolves.toBeNull()
        await expect(service.requireWhole("ws-1", "inst-1")).resolves.toBeUndefined()
        await expect(service.publish(APPLIER)).resolves.toBeUndefined()
        await expect(service.seatNamed("ws-1", "Nam")).resolves.toBeNull()
    })
})
