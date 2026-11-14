import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { DeskAsker } from "./agent-desk.contracts"
import { AgentDeskService } from "./agent-desk.service"
import { DeskFlowsService } from "./desk-flows.service"
import { DeskReachService } from "./desk-reach.service"
import { DeskRunsService } from "./desk-runs.service"
import { DeskWaitingService } from "./desk-waiting.service"

const ASKER: DeskAsker = { workspaceId: "ws-1", memberId: "seat-1", locale: "en" }
const INSTALLATION = "0b9d3f8e-1c2a-4b5d-8e6f-7a8b9c0d1e2f"
const BARE = "1c2a4b5d-8e6f-4a8b-9c0d-1e2f0b9d3f8e"
const ELSEWHERE = "2d3e4f50-6172-4839-8a4b-5c6d7e8f9012"
const ITEM = "3e4f5061-7283-4940-9b5c-6d7e8f901234"
const DAY = { timeZone: "UTC", now: new Date("2026-11-12T04:00:00.000Z") }

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    installations.find.mockImplementation((_workspaceId, id) =>
        Promise.resolve(
            id === INSTALLATION
                ? mock<InstallationRecord>({ id, agentId: "agent-1" })
                : id === BARE
                  ? mock<InstallationRecord>({ id, agentId: null })
                  : null,
        ),
    )
    const flows = mock<DeskFlowsService>()
    flows.flows.mockResolvedValue({ flows: [] })
    const waits = mock<DeskWaitingService>()
    waits.waiting.mockResolvedValue({ count: 0, rows: [] })
    waits.decide.mockResolvedValue({ kind: "decided", status: "done" })
    const runs = mock<DeskRunsService>()
    runs.runFacts.mockResolvedValue([])
    runs.today.mockResolvedValue({ day: "2026-11-12", answered: 3, recordsRead: 9, recordsChanged: 1, uncounted: 0 })
    const reaches = mock<DeskReachService>()
    reaches.reach.mockResolvedValue({ accounts: [], auto: ["Read customers"], ask: [], none: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentDeskService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: DeskFlowsService, useValue: flows },
            { provide: DeskWaitingService, useValue: waits },
            { provide: DeskRunsService, useValue: runs },
            { provide: DeskReachService, useValue: reaches },
        ],
    }).compile()
    return { desk: moduleRef.get(AgentDeskService).portFor(ASKER), installations, flows, waits, runs, reaches }
}

describe("AgentDeskService: the platform.agent-desk port, scoped by installation", () => {
    it("reads each part for the agent the installation drives, in the proven workspace", async () => {
        const { desk, installations, flows, waits, runs, reaches } = await build()

        await desk.flows(INSTALLATION)
        await desk.waiting(INSTALLATION)
        await desk.decide(INSTALLATION, { id: ITEM, verdict: "approve" })
        await desk.runFacts(INSTALLATION, ["run-1"])
        await expect(desk.today(INSTALLATION, DAY)).resolves.toMatchObject({ answered: 3 })
        await expect(desk.reach(INSTALLATION)).resolves.toMatchObject({ auto: ["Read customers"] })

        expect(installations.find).toHaveBeenCalledWith("ws-1", INSTALLATION)
        expect(flows.flows).toHaveBeenCalledWith("ws-1", "agent-1", "en")
        expect(waits.waiting).toHaveBeenCalledWith(ASKER, "agent-1")
        expect(waits.decide).toHaveBeenCalledWith(ASKER, "agent-1", { id: ITEM, verdict: "approve" })
        expect(runs.runFacts).toHaveBeenCalledWith("ws-1", "agent-1", ["run-1"])
        expect(runs.today).toHaveBeenCalledWith("ws-1", "agent-1", DAY)
        expect(reaches.reach).toHaveBeenCalledWith(ASKER, "agent-1")
    })

    it("reads an installation of another workspace, or one that drives no agent, as empty, and decides nothing", async () => {
        const { desk, flows, waits, runs, reaches } = await build()

        for (const installation of [ELSEWHERE, BARE]) {
            await expect(desk.flows(installation)).resolves.toEqual({ flows: [] })
            await expect(desk.waiting(installation)).resolves.toEqual({ count: 0, rows: [] })
            await expect(desk.decide(installation, { id: ITEM, verdict: "approve" })).resolves.toEqual({
                kind: "refused",
                code: "not_waiting_here",
            })
            await expect(desk.runFacts(installation, ["run-1"])).resolves.toEqual([])
            await expect(desk.today(installation, DAY)).resolves.toEqual({
                day: "2026-11-12",
                answered: 0,
                recordsRead: 0,
                recordsChanged: 0,
                uncounted: 0,
            })
            await expect(desk.reach(installation)).resolves.toEqual({ accounts: [], auto: [], ask: [], none: [] })
        }
        expect(flows.flows).not.toHaveBeenCalled()
        expect(waits.decide).not.toHaveBeenCalled()
        expect(runs.today).not.toHaveBeenCalled()
        expect(reaches.reach).not.toHaveBeenCalled()
    })
})
