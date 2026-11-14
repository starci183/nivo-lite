import { builder } from "@starci/jest-preset"
import { APPEND_ENTRY, rightsWorldOf } from "@tests/fixtures/builders/agent-rights.builder"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { STAMP_ATTEMPTS } from "./agent-rights-records.service"
import type { RightsSettlement } from "./policies/node-rights-gate.policy"

describe("AgentRightsRecordsService.run and record", () => {
    const settlementOf = builder<RightsSettlement>({
        graphHash: "hash",
        agentId: "agent-1",
        workflowId: null,
        grants: [{ ...APPEND_ENTRY, origin: "owner" }],
        pending: [],
        agreedBy: "boss",
    })

    it("runs a write that brings no row in the engine's own scoped transaction, as before node rights", async () => {
        const { records, engine, consents } = await rightsWorldOf()

        await expect(
            records.run(
                "ws-1",
                settlementOf({ grants: [] }),
                () => Promise.resolve("done"),
                () => ({ workflowId: "wf-1", versionId: "v-1" }),
            ),
        ).resolves.toBe("done")

        expect(engine.scoped).toHaveBeenCalledTimes(1)
        expect(consents.transaction).not.toHaveBeenCalled()
    })

    it("writes the version and its rows on one transaction: the engine scope first, the rows once it is left", async () => {
        const { records, engine, consents, manager, written } = await rightsWorldOf()

        await records.run(
            "ws-1",
            settlementOf(),
            () => Promise.resolve("v-9"),
            (versionId) => ({ workflowId: "wf-1", versionId }),
        )

        expect(engine.scoped).not.toHaveBeenCalled()
        expect(engine.within).toHaveBeenCalledWith(manager, "ws-1", expect.any(Function))
        expect(consents.record).toHaveBeenCalledWith(manager, written)
        expect(written).toEqual([
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                workflowId: "wf-1",
                ...APPEND_ENTRY,
                origin: "owner",
                fromVersionId: "v-9",
                agreedBy: "boss",
            },
        ])
        expect(engine.within.mock.invocationCallOrder[0]).toBeLessThan(consents.record.mock.invocationCallOrder[0] ?? 0)
    })

    it("records later under the primary workflow, and nothing while the agent has none", async () => {
        const { records, workflows, written } = await rightsWorldOf()

        workflows.workflowsOf.mockResolvedValueOnce([])
        await records.record("ws-1", settlementOf(), "gv-1")
        expect(written).toEqual([])

        await records.record("ws-1", settlementOf(), "gv-1")
        expect(written.map((row) => [row.workflowId, row.fromVersionId])).toEqual([["wf-p", "gv-1"]])
    })
})

describe("AgentRightsRecordsService.stampOnce", () => {
    const settlementOf = builder<RightsSettlement>({
        graphHash: "hash",
        agentId: "agent-1",
        workflowId: "wf-p",
        grants: [{ ...APPEND_ENTRY, origin: "owner" }],
        pending: [],
        agreedBy: "boss",
    })

    /** The world with the settlement's rows already written naming no version. */
    const unstampedWorld = async () => {
        const world = await rightsWorldOf()
        await world.records.record("ws-1", settlementOf(), null)
        expect(world.written.map((row) => row.fromVersionId)).toEqual([null])
        return world
    }

    const versionsOf = (written: ReadonlyArray<{ readonly fromVersionId: string | null }>) =>
        written.map((row) => row.fromVersionId)

    it("names the rows written with no version the version the lookup answers, on a transaction of its own", async () => {
        const { records, consents, manager, written } = await unstampedWorld()

        await expect(records.stampOnce("ws-1", settlementOf(), () => Promise.resolve("wfv-1"))).resolves.toBe(1)

        expect(consents.stamp).toHaveBeenCalledWith(
            manager,
            [
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    workflowId: "wf-p",
                    ...APPEND_ENTRY,
                    origin: "owner",
                    fromVersionId: "wfv-1",
                    agreedBy: "boss",
                },
            ],
            "wfv-1",
        )
        expect(versionsOf(written)).toEqual(["wfv-1"])
    })

    it("sets the version once: a second stamp with another version changes nothing", async () => {
        const { records, written } = await unstampedWorld()

        await expect(records.stampOnce("ws-1", settlementOf(), () => Promise.resolve("wfv-1"))).resolves.toBe(1)
        await expect(records.stampOnce("ws-1", settlementOf(), () => Promise.resolve("wfv-2"))).resolves.toBe(0)

        expect(versionsOf(written)).toEqual(["wfv-1"])
    })

    it("stamps nothing when the lookup answers no version, and nothing for a settlement with no grant", async () => {
        const { records, consents, written } = await unstampedWorld()
        const lookup = jest.fn().mockResolvedValue("wfv-1")

        await expect(records.stampOnce("ws-1", settlementOf(), () => Promise.resolve(null))).resolves.toBe(0)
        await expect(records.stampOnce("ws-1", settlementOf({ grants: [] }), lookup)).resolves.toBe(0)

        expect(lookup).not.toHaveBeenCalled()
        expect(consents.stamp).not.toHaveBeenCalled()
        expect(versionsOf(written)).toEqual([null])
    })

    it("tries a failed stamp again in the same call, and the rows are named", async () => {
        const { records, consents, logger, written, notices } = await unstampedWorld()
        consents.stamp.mockRejectedValueOnce(new Error("deadlock"))

        await expect(records.stampOnce("ws-1", settlementOf(), () => Promise.resolve("wfv-1"))).resolves.toBe(1)

        expect(consents.stamp).toHaveBeenCalledTimes(2)
        expect(logger.error).not.toHaveBeenCalled()
        expect(notices.publishUnfinished).not.toHaveBeenCalled()
        expect(versionsOf(written)).toEqual(["wfv-1"])
    })

    it("gives up after STAMP_ATTEMPTS failed stamps: logs once, answers 0, never throws, the rows keep no version", async () => {
        const { records, consents, logger, written, notices } = await unstampedWorld()
        const cause = new Error("down")
        consents.stamp.mockRejectedValue(cause)

        await expect(records.stampOnce("ws-1", settlementOf(), () => Promise.resolve("wfv-1"), "graph-v2")).resolves.toBe(0)

        expect(consents.stamp).toHaveBeenCalledTimes(STAMP_ATTEMPTS)
        // Unhandled never silent: the founder is told once, for the published version.
        expect(notices.publishUnfinished.mock.calls).toEqual([
            [{ workspaceId: "ws-1", agentId: "agent-1", workflowId: "wf-p", graphVersionId: "graph-v2" }],
        ])
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.RightsStampFailed, cause, {
            agentId: "agent-1",
            workflowId: "wf-p",
        })
        expect(versionsOf(written)).toEqual([null])
    })

    it("tries a lookup that throws again the same way: once more succeeds, always fails gives up and logs", async () => {
        const { records, consents, logger, written } = await unstampedWorld()
        const flaky = jest.fn().mockRejectedValueOnce(new Error("adopt")).mockResolvedValue("wfv-1")

        await expect(records.stampOnce("ws-1", settlementOf(), flaky)).resolves.toBe(1)
        expect(flaky).toHaveBeenCalledTimes(2)
        expect(versionsOf(written)).toEqual(["wfv-1"])

        const cause = new Error("adopt")
        const broken = jest.fn().mockRejectedValue(cause)
        await expect(records.stampOnce("ws-1", settlementOf({ agentId: "agent-2" }), broken)).resolves.toBe(0)

        expect(broken).toHaveBeenCalledTimes(STAMP_ATTEMPTS)
        expect(consents.stamp).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.RightsStampFailed, cause, {
            agentId: "agent-2",
            workflowId: "wf-p",
        })
    })
})
