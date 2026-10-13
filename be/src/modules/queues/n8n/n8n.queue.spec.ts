import { mock } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { QueueOutbox } from "@modules/platform/queue"
import type { N8nEmitPayload } from "./n8n.contracts"
import { isN8nEmitPayload, N8nQueue } from "./n8n.queue"

const PAYLOAD: N8nEmitPayload = {
    workspaceId: "ws-1",
    runId: "run-1",
    event: "pipeline.email-daily-report",
    urls: ["https://workflow.example.test/webhook/daily"],
    paths: ["nivo/daily"],
    data: { date: "2026-10-13" },
}

describe("isN8nEmitPayload", () => {
    it.each([
        { label: "undefined", value: undefined },
        { label: "null", value: null },
        { label: "a string", value: "payload" },
        { label: "a number", value: 1 },
        { label: "a boolean", value: false },
        { label: "an empty array", value: [] },
        { label: "a missing workspace ID", value: {} },
        { label: "a non-string workspace ID", value: { workspaceId: 1 } },
        { label: "a missing run ID", value: { workspaceId: "ws-1" } },
        { label: "a non-string run ID", value: { ...PAYLOAD, runId: 1 } },
        { label: "a missing event", value: { workspaceId: "ws-1", runId: "run-1" } },
        { label: "a non-string event", value: { ...PAYLOAD, event: null } },
        { label: "missing URLs", value: { workspaceId: "ws-1", runId: "run-1", event: "daily" } },
        { label: "non-array URLs", value: { ...PAYLOAD, urls: "https://workflow.example.test" } },
        { label: "missing paths", value: { workspaceId: "ws-1", runId: "run-1", event: "daily", urls: [] } },
        { label: "non-array paths", value: { ...PAYLOAD, paths: "nivo/daily" } },
        {
            label: "missing data",
            value: { workspaceId: "ws-1", runId: "run-1", event: "daily", urls: [], paths: [] },
        },
        { label: "undefined data", value: { ...PAYLOAD, data: undefined } },
        { label: "string data", value: { ...PAYLOAD, data: "body" } },
        { label: "null data", value: { ...PAYLOAD, data: null } },
    ])("rejects $label", ({ value }) => {
        expect(isN8nEmitPayload(value)).toBe(false)
    })

    it.each([
        { label: "a populated delivery", value: PAYLOAD },
        { label: "empty destinations and data", value: { ...PAYLOAD, urls: [], paths: [], data: {} } },
        { label: "array data", value: { ...PAYLOAD, data: [{ id: "lead-1" }] } },
    ])("accepts $label", ({ value }) => {
        expect(isN8nEmitPayload(value)).toBe(true)
    })
})

describe("N8nQueue", () => {
    it("writes the delivery in the caller's transaction with a dedupe key for the run", async () => {
        const outbox = mock<QueueOutbox>()
        const tx = mock<EntityManager>()
        const queue = new N8nQueue(outbox)
        outbox.write.mockResolvedValue(undefined)

        await expect(queue.enqueueEmit(PAYLOAD, tx)).resolves.toBeUndefined()

        expect(outbox.write).toHaveBeenCalledTimes(1)
        expect(outbox.write).toHaveBeenCalledWith(tx, "n8n", PAYLOAD, {
            job: "n8n.emit",
            dedupeKey: "n8n.emit:run-1",
        })
    })

    it("returns the outbox promise and propagates a failed write", async () => {
        const outbox = mock<QueueOutbox>()
        const tx = mock<EntityManager>()
        const queue = new N8nQueue(outbox)
        const failure = new Error("outbox unavailable")
        const pending = Promise.reject(failure)
        outbox.write.mockReturnValue(pending)

        const result = queue.enqueueEmit({ ...PAYLOAD, runId: "run-2" }, tx)

        expect(result).toBe(pending)
        await expect(result).rejects.toBe(failure)
        expect(outbox.write).toHaveBeenCalledWith(tx, "n8n", { ...PAYLOAD, runId: "run-2" }, {
            job: "n8n.emit",
            dedupeKey: "n8n.emit:run-2",
        })
    })
})
