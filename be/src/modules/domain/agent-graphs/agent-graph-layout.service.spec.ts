import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { AgentGraphLayoutService } from "./agent-graph-layout.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import type { WorkflowView } from "./agent-workflows.contracts"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const SAVED = [
    { workflowKey: "reports", x: 1, y: 2 },
    { workflowKey: "gone", x: 3, y: 4 },
]

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    installations.find.mockResolvedValue(
        mock<InstallationRecord>({ settings: { processor: "nivo", graphLayout: SAVED } }),
    )
    installations.saveSettings.mockResolvedValue("done")
    const workflows = mock<AgentWorkflowsService>()
    workflows.list.mockResolvedValue([mock<WorkflowView>({ key: "reports" }), mock<WorkflowView>({ key: "intake" })])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphLayoutService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentWorkflowsService, useValue: workflows },
        ],
    }).compile()
    return { layouts: moduleRef.get(AgentGraphLayoutService), installations, workflows }
}

describe("AgentGraphLayoutService", () => {
    it("reads the saved layout without the workflows the agent no longer has", async () => {
        const { layouts, workflows } = await build()

        await expect(layouts.read("ws-1", "inst-1", "agent-1")).resolves.toEqual([
            { workflowKey: "reports", x: 1, y: 2 },
        ])
        expect(workflows.list).toHaveBeenCalledWith("ws-1", "agent-1", "vi")
    })

    it("replaces the layout whole in the settings, keeps the other settings and answers what is kept", async () => {
        const { layouts, installations } = await build()

        const kept = await layouts.save("ws-1", "inst-1", "agent-1", [
            { workflowKey: "intake", x: 5, y: 6 },
            { workflowKey: "gone", x: 7, y: 8 },
        ])

        expect(kept).toEqual([{ workflowKey: "intake", x: 5, y: 6 }])
        expect(installations.saveSettings).toHaveBeenCalledWith("ws-1", "inst-1", {
            processor: "nivo",
            graphLayout: [{ workflowKey: "intake", x: 5, y: 6 }],
        })
    })

    it("refuses an out-of-bounds position without writing, and an installation that is not there", async () => {
        const { layouts, installations } = await build()

        await expect(
            layouts.save("ws-1", "inst-1", "agent-1", [{ workflowKey: "reports", x: 1e9, y: 0 }]),
        ).rejects.toMatchObject({ code: AgentGraphsErrorCode.WorkflowRefused })
        expect(installations.saveSettings).not.toHaveBeenCalled()
        installations.find.mockResolvedValue(null)
        await expect(layouts.read("ws-1", "inst-x", "agent-1")).rejects.toMatchObject({
            code: AgentGraphsErrorCode.GraphNotFound,
        })
    })
})
