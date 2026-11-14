import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { approvalDecideAction } from "../actions/approval-decide.action"
import { deskRowKeyOf, deskRowOfKey } from "../agent-desk"
import { DESK_FLOWS_VIEW, DESK_WAITING_VIEW } from "../fixtures/agent-desk.fixtures"
import { INSTALLATION_ID, RUNS_CONTEXT } from "../fixtures/agent-runs.ports"
import type { AgentDesk, ApprovalDecideAnswer, ApprovalVerdictAsk } from "../platform.types"
import { agentDeskPort } from "../ports"
import { PLATFORM_REFUSAL_WORDS } from "../refusals"
import { agentFlowsRead, agentReachRead, agentTodayRead, waitingOnPersonRead } from "./agent-desk.reads"

const unused = (): Promise<never> => Promise.reject(new Error("unused"))

/** A waiting row's id: a work item, one uuid. */
const ITEM = "7d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6"

/** A desk that answers what is given and records the calls it got. */
const deskOf = (answers: Partial<AgentDesk>) => {
    const calls: Array<readonly [string, ...ReadonlyArray<unknown>]> = []
    const desk: AgentDesk = {
        flows: (installation) => {
            calls.push(["flows", installation])
            return answers.flows?.(installation) ?? unused()
        },
        waiting: (installation) => {
            calls.push(["waiting", installation])
            return answers.waiting?.(installation) ?? unused()
        },
        decide: (installation, ask) => {
            calls.push(["decide", installation, ask])
            return answers.decide?.(installation, ask) ?? unused()
        },
        runFacts: unused,
        today: (installation, day) => {
            calls.push(["today", installation, day])
            return answers.today?.(installation, day) ?? unused()
        },
        reach: (installation) => {
            calls.push(["reach", installation])
            return answers.reach?.(installation) ?? unused()
        },
    }
    const provider: PortProvider = {
        implementationOf: (port) => {
            if (port.id !== agentDeskPort.id) throw new Error(port.id)
            return desk
        },
    }
    return { provider, calls }
}

describe("the reads of the agent's work desk", () => {
    it("are record reads behind the platform view permission, each over the one desk port and the installation", () => {
        for (const read of [agentFlowsRead, waitingOnPersonRead, agentTodayRead, agentReachRead]) {
            expect(read.permission).toBe("platform.view")
            expect(read.shape).toBe("record")
            expect(Object.values(read.ports ?? {}).map((port) => port.id)).toEqual(["platform.agent-desk"])
            expect(Object.keys(read.variables.shape)).toEqual(["installation"])
        }
    })

    it("draws the flows from the running graph with the canvas's own cards, the primary first, with the totals", async () => {
        const graph = DESK_FLOWS_VIEW.flows[0]?.graph
        const { provider } = deskOf({
            flows: () =>
                Promise.resolve({
                    flows: [
                        { key: "side", name: "Ph\u1ee5", isPrimary: false, graphJson: "{not json" },
                        { key: "main", name: "Ch\u00ednh", isPrimary: true, graphJson: JSON.stringify({ nodes: [], edges: [] }) },
                    ],
                }),
        })
        const answer = await agentFlowsRead.execute?.(provider, { installation: INSTALLATION_ID }, RUNS_CONTEXT)
        expect(answer).toMatchObject({ ok: true, data: { workflows: 2, flows: [{ key: "main" }, { key: "side", graph: null, steps: 0 }] } })
        expect(graph?.nodes.length).toBeGreaterThan(0)
        expect(DESK_FLOWS_VIEW.steps).toBe(graph?.nodes.length)
    })

    it("lays the waiting rows out for the queue: who asked, when, what changes; verdicts only on an approval", async () => {
        const { provider } = deskOf({
            waiting: () =>
                Promise.resolve({
                    count: 1,
                    rows: [
                        {
                            id: ITEM,
                            runId: "run-1",
                            title: "Change a phone number",
                            askedBy: "Tu",
                            askedAt: "2026-11-05T08:00:00.000Z",
                            line: "CRM \u00b7 update contact",
                            commands: ["decline", "approve"],
                        },
                    ],
                }),
        })
        const answer = await waitingOnPersonRead.execute?.(provider, { installation: INSTALLATION_ID }, RUNS_CONTEXT)
        expect(answer).toMatchObject({
            ok: true,
            data: {
                count: "1",
                rows: [
                    {
                        id: deskRowKeyOf(INSTALLATION_ID, ITEM),
                        title: "Change a phone number",
                        description: "Tu \u00b7 11/5/26, 8:00 AM \u00b7 CRM \u00b7 update contact",
                        primary: { id: "approve" },
                        alternative: { id: "decline" },
                    },
                ],
            },
        })
        expect(DESK_WAITING_VIEW.rows.map((row) => row.askedAt)).toEqual(["2026-11-12T01:40:00.000Z", "2026-11-12T02:12:00.000Z"])
        expect(DESK_WAITING_VIEW.rows[0]).toMatchObject({ primary: null, alternative: null })
        expect(DESK_WAITING_VIEW.rows[0]?.description).not.toContain("null")
    })

    it("counts nothing waiting as no count, not zero", async () => {
        const { provider } = deskOf({ waiting: () => Promise.resolve({ count: 0, rows: [] }) })
        const answer = await waitingOnPersonRead.execute?.(provider, { installation: INSTALLATION_ID }, RUNS_CONTEXT)
        expect(answer).toEqual({ ok: true, data: { count: null, more: null, rows: [] } })
    })

    it("asks today's counts in the workspace's zone at the read's instant, and hands nulls through (a dash, never 0)", async () => {
        const { provider, calls } = deskOf({
            today: () => Promise.resolve({ day: "2026-11-05", answered: 2, recordsRead: null, recordsChanged: null, uncounted: 3 }),
        })
        const answer = await agentTodayRead.execute?.(provider, { installation: INSTALLATION_ID }, RUNS_CONTEXT)
        expect(answer).toMatchObject({ ok: true, data: { recordsRead: null, recordsChanged: null, uncounted: 3 } })
        expect(calls).toEqual([["today", INSTALLATION_ID, { timeZone: "UTC", now: RUNS_CONTEXT.now }]])
    })

    it("refuses an installation that is no id", async () => {
        const { provider } = deskOf({})
        await expect(agentReachRead.execute?.(provider, { installation: "x" }, RUNS_CONTEXT)).resolves.toMatchObject({ ok: false })
    })
})

describe("platform.approval-decide", () => {
    const decideWith = (answer: ApprovalDecideAnswer) =>
        deskOf({ decide: (_installation: string, _ask: ApprovalVerdictAsk) => Promise.resolve(answer) })

    it("hands the verdict on the row to the desk, scoped to the installation the row was read under", async () => {
        const { provider, calls } = decideWith({ kind: "decided", status: "approved" })
        const key = deskRowKeyOf(INSTALLATION_ID, ITEM)
        await expect(approvalDecideAction.execute?.(provider, { id: key, command: "approve" }, RUNS_CONTEXT)).resolves.toEqual({
            ok: true,
        })
        expect(calls).toEqual([["decide", INSTALLATION_ID, { id: ITEM, verdict: "approve" }]])
    })

    it("refuses as data: a row no longer waiting, a refusal of the decide door, a key no desk read made", async () => {
        const gone = decideWith({ kind: "refused", code: "not_waiting_here" })
        await expect(
            approvalDecideAction.execute?.(gone.provider, { id: deskRowKeyOf(INSTALLATION_ID, ITEM), command: "decline" }, RUNS_CONTEXT),
        ).resolves.toMatchObject({ ok: false, message: PLATFORM_REFUSAL_WORDS.not_waiting })
        const door = decideWith({ kind: "refused", code: "DECISIONS_NOT_APPROVER" })
        await expect(
            approvalDecideAction.execute?.(door.provider, { id: deskRowKeyOf(INSTALLATION_ID, ITEM), command: "approve" }, RUNS_CONTEXT),
        ).resolves.toMatchObject({ ok: false, message: PLATFORM_REFUSAL_WORDS.decide_refused })
        const loose = decideWith({ kind: "decided", status: "approved" })
        await expect(approvalDecideAction.execute?.(loose.provider, { id: "item-1", command: "approve" }, RUNS_CONTEXT)).resolves.toMatchObject({
            ok: false,
        })
        expect(loose.calls).toEqual([])
        expect(deskRowOfKey("~x")).toBeNull()
        expect(deskRowOfKey(`${INSTALLATION_ID}~${ITEM}~${ITEM}`)).toBeNull()
        expect(deskRowOfKey(`${INSTALLATION_ID}~item-1`)).toBeNull()
        expect(deskRowOfKey(`x~${ITEM}`)).toBeNull()
        expect(deskRowOfKey(deskRowKeyOf(INSTALLATION_ID, ITEM))).toEqual({ installation: INSTALLATION_ID, id: ITEM })
    })

    it("refreshes the queue, the runs and today's counts", () => {
        expect(approvalDecideAction.refreshes).toEqual(["platform.waiting-on-person", "platform.agent-runs", "platform.agent-today"])
    })
})
