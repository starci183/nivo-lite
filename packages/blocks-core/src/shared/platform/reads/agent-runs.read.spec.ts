import {
    AGENT_ID,
    INSTALLATION_ID,
    RUNS_CONTEXT,
    coreRun,
    factsDesk,
    recordedCore,
    runsProvider,
} from "../fixtures/agent-runs.ports"
import { RUNS_PAGE, RUNS_PAGE_MAX, agentRunsRead } from "./agent-runs.read"

const RUN = coreRun("run-1", {
    agentId: AGENT_ID,
    trigger: "zalo.message",
    status: "parked",
    startedAt: "2026-11-05T08:00:00.000Z",
    endedAt: null,
})

const run = (
    raw: unknown,
    agents: Readonly<Record<string, string>> = { [INSTALLATION_ID]: AGENT_ID },
    next: string | null = null,
    desk = factsDesk(),
) => {
    const runs = recordedCore([RUN], { next, agents })
    return {
        runs,
        desk,
        result: agentRunsRead.execute?.(runsProvider(runs.core, desk.desk), raw, RUNS_CONTEXT),
    }
}

describe("platform.agent-runs", () => {
    it("lists the runs of the agent the installation runs, newest first, one page at a time, with the cursor of the next", async () => {
        const { runs, result } = run({ installation: INSTALLATION_ID }, undefined, "cursor-2")
        await expect(result).resolves.toEqual({
            ok: true,
            data: {
                rows: [
                    {
                        id: "run-1",
                        status: "parked",
                        trigger: "zalo.message",
                        when: "11/5/26, 8:00 AM",
                        duration: "10:00",
                        subject: "zalo.message",
                        ask: null,
                        askedBy: null,
                        readCount: null,
                        changedCount: null,
                        uncounted: 0,
                        outcome: null,
                        facts: "11/5/26, 8:00 AM \u00b7 read \u2014 \u00b7 changed \u2014",
                    },
                ],
                cursor: "cursor-2",
            },
        })
        expect(runs.lists[0]).toEqual({ agent: AGENT_ID, order: "started", size: RUNS_PAGE })
    })

    it("narrows the page to the statuses of a filter, and not at all for all", async () => {
        const narrowed = run({ installation: INSTALLATION_ID, status: "failed" })
        await narrowed.result
        expect(narrowed.runs.lists[0]).toEqual({ agent: AGENT_ID, statuses: ["failed", "dead"], order: "started", size: RUNS_PAGE })
        const everything = run({ installation: INSTALLATION_ID, status: "all" })
        await everything.result
        expect(everything.runs.lists[0]).toEqual({ agent: AGENT_ID, order: "started", size: RUNS_PAGE })
    })

    it("asks for the page after the cursor, with the limit given", async () => {
        const next = run({ installation: INSTALLATION_ID, cursor: "cursor-2", limit: 5 })
        await next.result
        expect(next.runs.lists[0]).toMatchObject({ size: 5, after: "cursor-2" })
    })

    it("lists nothing for an installation the workspace does not have, and asks the desk nothing", async () => {
        const { runs, desk, result } = run({ installation: INSTALLATION_ID }, {})
        await expect(result).resolves.toEqual({ ok: true, data: { rows: [], cursor: null } })
        expect(runs.lists).toEqual([])
        expect(desk.asked).toEqual([])
    })

    it("merges the desk's facts of the page by run id: the question as the headline, who asked, the records read and changed", async () => {
        const desk = factsDesk([
            {
                runId: "run-1",
                ask: "Minh An c\u00f2n d\u1ecbch v\u1ee5 n\u00e0o s\u1eafp h\u1ebft h\u1ea1n?",
                askedBy: "Lan",
                readCount: 4,
                changedCount: 0,
                uncounted: 1,
                outcome: "answered",
            },
            { runId: "run-other", ask: "x", askedBy: null, readCount: 1, changedCount: 1, uncounted: 0, outcome: "changed" },
        ])
        const { result } = run({ installation: INSTALLATION_ID }, undefined, null, desk)
        await expect(result).resolves.toMatchObject({
            ok: true,
            data: {
                rows: [
                    {
                        id: "run-1",
                        subject: "Minh An c\u00f2n d\u1ecbch v\u1ee5 n\u00e0o s\u1eafp h\u1ebft h\u1ea1n?",
                        askedBy: "Lan",
                        readCount: 4,
                        changedCount: 0,
                        uncounted: 1,
                        outcome: "answered",
                        facts: "Lan \u00b7 11/5/26, 8:00 AM \u00b7 read 4 \u00b7 changed 0",
                    },
                ],
            },
        })
        expect(desk.asked).toEqual([["run-1"]])
    })

    it("refuses an installation that is no id, a limit beyond the bound and a variable it does not declare", async () => {
        await expect(run({ installation: "x" }).result).resolves.toMatchObject({ ok: false })
        await expect(run({ installation: INSTALLATION_ID, limit: RUNS_PAGE_MAX + 1 }).result).resolves.toMatchObject({
            ok: false,
        })
        await expect(run({ installation: INSTALLATION_ID, owner: "x" }).result).resolves.toMatchObject({ ok: false })
        await expect(run({ installation: INSTALLATION_ID, status: "gone" }).result).resolves.toMatchObject({
            ok: false,
        })
    })

    it("is read with the platform view permission and lists rows", () => {
        expect(agentRunsRead.permission).toBe("platform.view")
        expect(agentRunsRead.shape).toBe("list")
    })

    it("tells a host it is a list paged by a cursor, newest first, one page of the default size", () => {
        expect(agentRunsRead.listing).toMatchObject({ kind: "list", defaultSort: "recent" })
        expect(agentRunsRead.listing?.kind === "list" ? agentRunsRead.listing.shape.page.size : 0).toBe(RUNS_PAGE)
    })
})
