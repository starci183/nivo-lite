import { z } from "zod"
import { TRIGGER as TRIGGERS } from "@nivo-lite/agent-sdk/names"
import { defineTemplateGraph, endRound, loop, node, outcome, present, ref, trigger, wait, waitFor } from "@nivo-lite/agent-sdk/template"
import type { AgentRunsService } from "@modules/domain/agent-runs"
import { ThreadWaitExpiryService } from "@modules/domain/agent-threads"
import { INSTALLED, graphOfSpecV2 } from "@modules/domain/installed-plugins"
import { NOTE_WRITE, writeAutoNode } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { CONV, WS, drain, startThread, threadDbOf, type ThreadDb } from "./thread-world"
import { coreProcessOf, noteActsOf, threadOf } from "./thread-world-core"

// SANDBOX "EXPIRE THIS RUN'S WAIT NOW" (owner rulings R62 + R66; worker SBX-2): "not paid" is TIME, so the dev Sandbox page's button
// runs the REAL deadline road for a run parked at a wait (`ThreadWaitExpiryService.expireNow` -> `ThreadDeadlinesService.fireNow` with the
// wait's own deadline payload -> `ThreadWaitsService.timedOut`). The graph is a sale's payment wait in miniature, generic: a loop of at
// most 6 rounds, each a `wait` for the customer's line (standing in for the bank credit) with a timeout whose road writes a reminder;
// the loop running out writes `unpaid`. Real: the thread engine, the loop, the wait, the deadline road, the drain. Faked: the outside
// world, the test write's executor, the queue outbox.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** The rounds of the payment wait (the sales graph's `PAY_ROUNDS`). */
const ROUNDS = 6

/** A write of a fixed line that ends the round. */
const writeAndEndRound = (text: string) =>
    node(writeAutoNode, { input: { noteId: ref("trigger.noteId"), text }, routes: { done: endRound, declined: endRound } })

/** The payment wait in miniature: up to 6 rounds of (wait for the line | timeout -> reminder), then `unpaid`. */
const payWaitGraph = defineTemplateGraph({
    key: "tcore.pay-wait",
    title: { vi: "Chờ trả tiền", en: "Pay wait" },
    input: z.object({ noteId: z.string().max(500), text: z.string().max(500), conversationId: z.string().max(500) }),
    triggers: [trigger(TRIGGERS.workflowCalled)],
    openTo: "any",
    start: "pay",
    nodes: {
        pay: loop({
            until: present(ref("steps.paid.output.written")),
            max: ROUNDS,
            body: {
                start: "hold",
                nodes: {
                    hold: wait({ for: { line: waitFor(TRIGGERS.zaloMessageReceived) }, timeout: { minutes: 60 }, next: { line: "paid", timeout: "remind" } }),
                    paid: writeAndEndRound("da tra"),
                    remind: writeAndEndRound("nhac thanh toan"),
                },
            },
            next: "done",
            exhausted: "unpaid",
        }),
        unpaid: node(writeAutoNode, { input: { noteId: ref("trigger.noteId"), text: "unpaid" }, routes: { done: "end", declined: "end" } }),
        done: outcome({ name: "done" }),
        end: outcome({ name: "unpaid" }),
    },
})

/** The graph as the engine runs it. */
const FLOW = graphOfSpecV2(payWaitGraph.spec, {
    legacyNodeOf: (id: string) => INSTALLED.nodeInstall().nodes.find((one) => one.id === id),
    templateNodeOf: (id: string) => [writeAutoNode].find((one) => one.id === id),
})

/** The lines the run wrote, in order. */
const linesOf = (db: ThreadDb): ReadonlyArray<unknown> =>
    noteActsOf(db)
        .filter((act) => act.effect === NOTE_WRITE)
        .map((act) => act.payload.text)

/** A sale parked at its payment wait, and the expiry service over the world's real deadlines and threads. */
const parkedSale = async () => {
    const db = threadDbOf()
    const process = await coreProcessOf(db, { outbox: jobRecordingOutbox() })
    const woken = await startThread(process, {
        flow: FLOW,
        versionId: "tcore.pay-wait@1",
        trigger: { noteId: "note-1", text: "don", conversationId: CONV, routeId: CONV, locale: "vi" },
        workflowId: "wf:tcore.pay-wait",
    })
    if (woken.error !== null) throw woken.error
    const runId = woken.runId ?? ""
    // The world's run store is a double without the wait-mark query: the list's own query is the store's (not reachable here).
    const runs = {
        parkedAtWait: async () => {
            const run = await process.runs.runOf(WS, runId)
            return run === null ? [] : [run]
        },
    } as unknown as AgentRunsService
    if (process.deadlines === undefined) throw new Error("the world has no deadlines")
    const expiry = new ThreadWaitExpiryService(runs, process.deadlines, process.threads)
    /** Expires the wait now through the real road, then drains the wake it wrote. */
    const expire = async () => {
        const from = db.wakes.length
        const firing = await expiry.expireNow(WS, runId)
        await drain(process, from)
        return firing
    }
    return { db, process, runId, expiry, expire }
}

describe("sandbox: expire this run's wait now (the real deadline road)", () => {
    it("lists the run parked at its wait: the park, what it waits for, its deadline", async () => {
        const { expiry, runId } = await parkedSale()

        const parked = await expiry.parked(WS, 10)

        expect(parked).toHaveLength(1)
        expect(parked[0]).toMatchObject({
            runId,
            parkKey: "pay[r1].hold",
            waitsFor: [{ key: "line", verb: expect.any(String) }],
            dueAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
        })
    })

    it("expired ONCE: the timeout road runs (one reminder) and the run parks again at the next round's wait", async () => {
        const { db, process, runId, expire, expiry } = await parkedSale()

        await expect(expire()).resolves.toBe("admitted")

        expect(linesOf(db)).toEqual(["nhac thanh toan"])
        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("stopped")
        expect(thread.steps["pay[r1].hold"]).toMatchObject({ output: { trigger: "timeout" } })
        expect((await expiry.parked(WS, 10))[0]?.parkKey).toBe("pay[r2].hold")
    })

    it("expired SIX times: six reminders, the loop runs out and the run ends `unpaid`; a seventh finds no wait (`closed`)", async () => {
        const { db, process, runId, expire } = await parkedSale()

        for (let round = 1; round <= ROUNDS; round += 1) {
            // eslint-disable-next-line no-await-in-loop
            await expect(expire()).resolves.toBe("admitted")
        }

        expect(linesOf(db)).toEqual([...Array.from({ length: ROUNDS }, () => "nhac thanh toan"), "unpaid"])
        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("ended")
        expect(thread.steps.end).toMatchObject({ output: { outcome: "unpaid" } })
        await expect(expire()).resolves.toBe("closed")
    })
})
