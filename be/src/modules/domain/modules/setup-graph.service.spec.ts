import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { SETUP_GRAPH } from "./modules.decorators"
import type { SetupApplicant, SetupApplier, SetupGraphPort } from "./modules.port"
import { SetupGraphService } from "./setup-graph.service"

const APPLICANT: SetupApplicant = { workspaceId: "ws-1", principalId: "user-1", installationId: "inst-1" }
const APPLIER: SetupApplier = { ...APPLICANT, version: 8, contextVersionId: "cv-1" }

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
    it("hands the publish to the graph", async () => {
        const found = await build({ publish: jest.fn().mockResolvedValue(undefined) })

        await found.service.publish(APPLIER)

        expect(found.graph.publish).toHaveBeenCalledWith(APPLIER)
    })

    it("asks the graph for the contracts the applied setup calls for", async () => {
        const { service, graph } = await build({ proposeContracts: jest.fn().mockResolvedValue(3) })

        await expect(service.proposeContracts(APPLIER)).resolves.toBe(3)

        expect(graph.proposeContracts).toHaveBeenCalledWith(APPLIER)
    })
})

describe("SetupGraphService checkPublish", () => {
    it("hands the check to the graph and answers its newest version, letting a refusal through", async () => {
        const open = await build({ checkPublish: jest.fn().mockResolvedValue(7) })
        const refused = await build({
            checkPublish: jest.fn().mockRejectedValue(new ModulesError({ code: ModulesErrorCode.NotFound })),
        })

        await expect(open.service.checkPublish(APPLICANT)).resolves.toBe(7)
        expect(open.graph.checkPublish).toHaveBeenCalledWith(APPLICANT)
        await expect(refused.service.checkPublish(APPLICANT)).rejects.toMatchObject({
            code: ModulesErrorCode.NotFound,
        })
    })
})

describe("SetupGraphService with no graph", () => {
    it("checks nothing and publishes nothing", async () => {
        const { service } = await buildWithoutGraph()

        await expect(service.checkPublish(APPLICANT)).resolves.toBe(0)
        await expect(service.publish(APPLIER)).resolves.toBeUndefined()
        await expect(service.proposeContracts(APPLIER)).resolves.toBe(0)
    })
})
