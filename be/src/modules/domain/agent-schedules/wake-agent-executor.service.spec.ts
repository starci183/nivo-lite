import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { AgentWakeService } from "@modules/domain/agent-work"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import { AutomationExtensionsService } from "@modules/domain/automations"
import type { ExecutorContext } from "@modules/domain/automations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WakeAgentExecutorService } from "./wake-agent-executor.service"

interface Options {
    readonly agent?: null
    readonly alreadyWoke?: boolean
}

const build = async ({ agent, alreadyWoke = false }: Options = {}) => {
    const agents = mock<AgentsService>()
    agents.profileOfDepartment.mockResolvedValue(agent === null ? null : mock<AgentProfile>({ id: "agent-1" }))
    const wakes = mock<AgentWakeService>()
    wakes.wake.mockResolvedValue(!alreadyWoke)
    const extensions = mock<AutomationExtensionsService>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            WakeAgentExecutorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: (key: string) => key }) },
            { provide: AutomationExtensionsService, useValue: extensions },
            { provide: AgentsService, useValue: agents },
            { provide: AgentWakeService, useValue: wakes },
        ],
    }).compile()
    return { executor: moduleRef.get(WakeAgentExecutorService), agents, wakes, extensions }
}

const contextOf = (moduleKey: string | null): ExecutorContext => ({
    workspaceId: "ws-1",
    pipeline: buildPipelineRow({ id: "p-1", module_key: moduleKey }),
    def: buildTemplate(),
    config: {},
    body: "",
    shop: buildShop(),
})

describe("WakeAgentExecutorService", () => {
    it("plugs the wake_agent executor into the engine when the app starts", async () => {
        const { executor, extensions } = await build()

        executor.onModuleInit()

        expect(typeof extensions.add.mock.calls[0]?.[0].executors?.["wake_agent"]).toBe("function")
    })

    it("hands the case to the running agent of the department, keyed by the run and the step", async () => {
        const { executor, agents, wakes } = await build()

        const result = await executor.wake(contextOf("accounting"), {
            runId: "run-9",
            step: "judge",
            subjectId: "inv-1",
        })

        expect(agents.profileOfDepartment).toHaveBeenCalledWith("ws-1", "accounting")
        expect(wakes.wake).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "internal",
            eventKey: "run-9:judge",
            context: { eventName: "automation_case", subjectId: "inv-1" },
            actorMemberId: null,
        })
        expect(result).toEqual({ status: "done", steps: [{ label: "agentSchedules.caseHandedOver", status: "done" }] })
    })

    it("keys on the pipeline when the run is not named, and names no subject the case does not carry", async () => {
        const { executor, wakes } = await build()

        await executor.wake(contextOf("accounting"), {})

        expect(wakes.wake).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ eventKey: "p-1:wake", context: { eventName: "automation_case" } }),
        )
    })

    it("says the agent already has a case it was handed before", async () => {
        const { executor } = await build({ alreadyWoke: true })

        await expect(executor.wake(contextOf("accounting"), { runId: "run-9", step: "judge" })).resolves.toMatchObject({
            status: "done",
            steps: [{ label: "agentSchedules.caseAlreadyHanded" }],
        })
    })

    it("skips when the department has no running agent, or the pipeline has no department", async () => {
        const none = await build({ agent: null })
        const loose = await build()

        await expect(none.executor.wake(contextOf("accounting"), {})).resolves.toMatchObject({ status: "skipped" })
        await expect(loose.executor.wake(contextOf(null), {})).resolves.toMatchObject({ status: "skipped" })
        expect(none.wakes.wake).not.toHaveBeenCalled()
        expect(loose.agents.profileOfDepartment).not.toHaveBeenCalled()
    })
})
