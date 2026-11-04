import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ParkedFlowAlert } from "@modules/platform/jobs"
import { AgentRunParkedAlertsService } from "./agent-run-parked-alerts.service"
import { WorkEngineService } from "./work-engine.service"

const ALERT: ParkedFlowAlert = {
    kind: "flow-parked",
    jobId: "run-1",
    flowKind: "agent-run",
    failureClass: "code",
    reason: "invalid_step_input",
    correlationId: "wake-1",
    build: "b2",
    action: "resume",
}

const build = async (options: { run?: ReturnType<typeof runViewOf> | null; installed?: boolean } = {}) => {
    const engine = mock<WorkEngineService>({ runWork: jest.fn().mockResolvedValue({ id: "item-1" }) })
    const runs = mock<AgentRunsService>({
        runOf: jest.fn().mockResolvedValue(options.run === undefined ? runViewOf({ status: "dead" }) : options.run),
    })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue(options.installed === false ? null : { moduleKey: "sales" }),
    })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, _params, locale) => `${key}|${String(locale)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunParkedAlertsService,
            { provide: AgentRunsService, useValue: runs },
            { provide: WorkEngineService, useValue: engine },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunParkedAlertsService), engine }
}

describe("AgentRunParkedAlertsService.raise", () => {
    it("opens the one review item of a parked run, under the key a graph node files its own review of the run under", async () => {
        const { service, engine } = await build()

        await service.raise(ALERT)

        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            expect.objectContaining({
                action: "review_agent_run",
                department: "sales",
                dedupeKey: "graph-node:work-item.raise:graph-run-dead:run-1",
                seed: {
                    summary: "decisions.runParked.title|vi",
                    fields: { runId: "run-1", code: "invalid_step_input", conversationId: "c-1" },
                },
                preset: true,
                forceAsk: "branch_ask",
            }),
        )
    })

    it("files the item under no department when the agent has no installation", async () => {
        const { service, engine } = await build({ installed: false })

        await service.raise(ALERT)

        expect(engine.runWork.mock.calls[0]?.[1]).not.toHaveProperty("department")
    })

    it("speaks English when the run's trigger says so", async () => {
        const { service, engine } = await build({ run: runViewOf({ status: "dead", context: { locale: "en" } }) })

        await service.raise(ALERT)

        expect(engine.runWork.mock.calls[0]?.[0]).toMatchObject({ locale: "en" })
        expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({ subject_id: null })
    })

    it("raises nothing for another kind of flow or for a run that is gone", async () => {
        const other = await build()
        const gone = await build({ run: null })

        await other.service.raise({ ...ALERT, flowKind: "outbox-job" })
        await gone.service.raise(ALERT)

        expect(other.engine.runWork).not.toHaveBeenCalled()
        expect(gone.engine.runWork).not.toHaveBeenCalled()
    })
})
