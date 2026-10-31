import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { CLOCK } from "@modules/platform/clock"
import { NewDocumentsProbeService } from "./new-documents-probe.service"

const NOW = "2026-11-10T03:00:00.000Z"
const DAY_AGO = new Date("2026-11-09T03:00:00.000Z")
const AGENT = { workspaceId: "ws-1", agentId: "agent-1" }

describe("NewDocumentsProbeService", () => {
    const build = async (installed: boolean, changed: ReadonlyArray<{ id: string; title: string }>) => {
        const installations = mock<InstallationRecordsService>({
            ofAgent: jest.fn().mockResolvedValue(installed ? { moduleKey: "chatbot" } : null),
        })
        const sources = mock<KnowledgeSourcesReadService>({ changedPublicSince: jest.fn().mockResolvedValue(changed) })
        const container = await Test.createTestingModule({
            providers: [
                NewDocumentsProbeService,
                { provide: InstallationRecordsService, useValue: installations },
                { provide: KnowledgeSourcesReadService, useValue: sources },
                { provide: CLOCK, useValue: new FakeClock(NOW) },
            ],
        }).compile()
        return { probe: container.get(NewDocumentsProbeService), sources }
    }

    it("names the documents of the module of the agent that changed over the last day", async () => {
        const { probe, sources } = await build(true, [{ id: "src-1", title: "Price list" }])

        await expect(probe.check(AGENT)).resolves.toEqual({
            work: true,
            brief: "New or changed documents: Price list.",
            subjectIds: ["src-1"],
        })
        expect(sources.changedPublicSince).toHaveBeenCalledWith("ws-1", "chatbot", DAY_AGO.toISOString(), 0, 6)
        expect(probe.key).toBe("new_documents")
    })

    it("finds no work when nothing changed, or when the agent has no installation", async () => {
        const quiet = await build(true, [])
        const homeless = await build(false, [{ id: "src-1", title: "Price list" }])

        await expect(quiet.probe.check(AGENT)).resolves.toEqual({ work: false })
        await expect(homeless.probe.check(AGENT)).resolves.toEqual({ work: false })
        expect(homeless.sources.changedPublicSince).not.toHaveBeenCalled()
    })
})
