import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { CHATBOT_MODULE } from "./chatbot.contracts"
import { ModuleTagGrantsService } from "./module-tag-grants.service"
import { ModulesService } from "./modules.service"
import { SALES_MODULE } from "./sales.contracts"

const record = (moduleKey: string, agentId: string | null): InstallationRecord =>
    ({ id: `inst-${moduleKey}`, workspaceId: "ws-1", moduleKey, agentId }) as InstallationRecord

const build = async (installed: ReadonlyArray<InstallationRecord>) => {
    const installations = mock<InstallationRecordsService>()
    installations.list.mockResolvedValue([...installed])
    const catalog = mock<ModulesService>()
    catalog.find.mockImplementation((key) =>
        Promise.resolve(
            [CHATBOT_MODULE, SALES_MODULE, ACCOUNTING_MODULE].find((module) => module.key === key) ?? SALES_MODULE,
        ),
    )
    const agents = mock<AgentsService>()
    agents.grantTags.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleTagGrantsService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModulesService, useValue: catalog },
            { provide: AgentsService, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(ModuleTagGrantsService), agents }
}

describe("ModuleTagGrantsService.grantFor", () => {
    it("lets Chatbot tag Sales and Accounting, and Sales tag Accounting, in a workspace that holds all three", async () => {
        const all = [record("chatbot", "chat"), record("sales", "sales"), record("accounting", "acc")]
        const { service, agents } = await build(all)

        await service.grantFor("ws-1", "chatbot", "chat")
        await service.grantFor("ws-1", "sales", "sales")
        await service.grantFor("ws-1", "accounting", "acc")

        const granted = agents.grantTags.mock.calls.flatMap(([, grants]) =>
            grants.map((grant) => `${grant.from}>${grant.to}`),
        )
        expect([...new Set(granted)].sort()).toEqual(["chat>acc", "chat>sales", "sales>acc"])
    })

    it("grants the right to the agent installed before it and to the one installed after, whichever comes second", async () => {
        const first = await build([record("sales", "sales"), record("chatbot", "chat")])
        const second = await build([record("chatbot", "chat"), record("sales", "sales")])

        await first.service.grantFor("ws-1", "chatbot", "chat")
        await second.service.grantFor("ws-1", "sales", "sales")

        expect(first.agents.grantTags).toHaveBeenCalledWith("ws-1", [{ from: "chat", to: "sales" }])
        expect(second.agents.grantTags).toHaveBeenCalledWith("ws-1", [{ from: "chat", to: "sales" }])
    })

    it("skips installations without an agent and grants nothing between modules that list no one", async () => {
        const { service, agents } = await build([
            record("chatbot", "chat"),
            record("sales", null),
            record("accounting", "acc"),
        ])

        await service.grantFor("ws-1", "accounting", "acc")

        expect(agents.grantTags).toHaveBeenCalledWith("ws-1", [{ from: "chat", to: "acc" }])
    })
})
