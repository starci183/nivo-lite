import { agentDeskPort, coreReadsPort, membersPort } from "../ports"
import { AGENT_ID, INSTALLATION_ID, coreRun, factsDesk, recordedCore, runsProvider } from "./agent-runs.ports"

describe("the fake core reads of the runs specs", () => {
    it("list the runs with no next page and no count unless told, get a run by id, and record what they were asked", async () => {
        const recorded = recordedCore([coreRun("a")])
        await expect(recorded.core.runs.list({ agent: AGENT_ID, order: "started", size: 1 })).resolves.toMatchObject({ next: null })
        await expect(recorded.core.runs.count(AGENT_ID)).resolves.toEqual([])
        await expect(recorded.core.runs.get("a")).resolves.toMatchObject({ id: "a" })
        await expect(recorded.core.runs.get("b")).resolves.toBeNull()
        await expect(recorded.core.runs.steps("a", 5)).resolves.toEqual([])
        expect(recorded.gets).toEqual(["a", "b"])
        expect(recorded.lists).toHaveLength(1)
        expect(recorded.counted).toEqual([{ agent: AGENT_ID, statuses: undefined }])
        expect(recorded.stepsAsked).toEqual([{ runId: "a", limit: 5 }])
    })

    it("answer the agent of the installation of the specs, and none of another", async () => {
        const { core } = recordedCore([])
        await expect(core.agentOf(INSTALLATION_ID)).resolves.toBe(AGENT_ID)
        await expect(core.agentOf("other")).resolves.toBeNull()
    })

    it("serve the ports of the reads, and nothing else", () => {
        const { core } = recordedCore([])
        const { desk } = factsDesk()
        const provider = runsProvider(core, desk)
        expect(provider.implementationOf(coreReadsPort)).toBe(core)
        expect(provider.implementationOf(agentDeskPort)).toBe(desk)
        expect(provider.implementationOf(membersPort)).toBeUndefined()
    })
})
