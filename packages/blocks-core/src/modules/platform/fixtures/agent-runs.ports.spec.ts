import { agentRuns } from "../ports"
import { recordedEntity, recordRow, runsProvider } from "./agent-runs.ports"

describe("the fake entities of the runs specs", () => {
    it("list the rows with no next page and no group unless told, and get a row by id", async () => {
        const entity = recordedEntity([recordRow("a", {})])
        await expect(entity.api.list({ select: [], order: [["id", "asc"]], page: { size: 1 } })).resolves.toMatchObject(
            {
                next: null,
            },
        )
        await expect(entity.api.aggregate({ measures: {}, limit: 1 })).resolves.toEqual([])
        await expect(entity.api.get("a")).resolves.toMatchObject({ id: "a" })
        await expect(entity.api.get("b")).resolves.toBeNull()
        expect(entity.gets).toEqual(["a", "b"])
    })

    it("refuse every write", async () => {
        const { api } = recordedEntity([])
        const refused = [
            api.insert({}),
            api.update("a", "1", {}),
            api.upsert("k", {}),
            api.ensure("k", {}),
            api.delete("a"),
            api.link("a", "r", "b"),
            api.unlink("a", "r", "b"),
        ]
        for (const attempt of refused) await expect(attempt).rejects.toThrow("unused")
    })

    it("serve the ports of the reads", () => {
        const [graphs, runs, steps] = [recordedEntity([]).api, recordedEntity([]).api, recordedEntity([]).api]
        const provider = runsProvider({ graphs, runs, steps })
        expect(provider.implementationOf(agentRuns)).toBe(runs)
    })
})
