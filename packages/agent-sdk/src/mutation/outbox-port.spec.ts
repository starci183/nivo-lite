import { z } from "../schema/zod-entry"
import { defineJob } from "./job"
import { ENQUEUE_DELAY_MAX_MS, enqueueOptionsSchema, OUTBOX_PORT_ID, outboxPort } from "./outbox-port"
import type { OutboxApi } from "./outbox-port"

describe("outboxPort", () => {
    it("is the engine.outbox port and its api takes a declared job and its input", async () => {
        expect(outboxPort).toEqual({ entry: "port", id: OUTBOX_PORT_ID })
        expect(OUTBOX_PORT_ID).toBe("engine.outbox")
        const seen: Array<string> = []
        const outbox: OutboxApi = {
            enqueue: (job, value, options) => {
                seen.push(`${job.name}:${JSON.stringify(value)}:${options?.dedupeKey ?? ""}`)
                return Promise.resolve()
            },
        }
        const job = defineJob({
            name: "demo.ledger",
            input: z.object({ id: z.uuid() }),
            ports: {},
            attempts: 2,
            run: () => Promise.resolve(),
        })
        await outbox.enqueue(job, { id: "0d9e5a64-3f6a-4f0b-9a54-3d1a7a0b8c11" }, { dedupeKey: "k", delayMs: 10 })
        expect(seen).toEqual(['demo.ledger:{"id":"0d9e5a64-3f6a-4f0b-9a54-3d1a7a0b8c11"}:k'])
    })
})

describe("enqueueOptionsSchema", () => {
    it("parses a dedupe key and a delay, both optional", () => {
        expect(enqueueOptionsSchema.safeParse({}).success).toBe(true)
        expect(enqueueOptionsSchema.safeParse({ dedupeKey: "k", delayMs: 0 }).success).toBe(true)
    })

    it("refuses an empty key, an unbounded key, a negative or too long delay and an unknown member", () => {
        expect(enqueueOptionsSchema.safeParse({ dedupeKey: "" }).success).toBe(false)
        expect(enqueueOptionsSchema.safeParse({ dedupeKey: "k".repeat(201) }).success).toBe(false)
        expect(enqueueOptionsSchema.safeParse({ delayMs: -1 }).success).toBe(false)
        expect(enqueueOptionsSchema.safeParse({ delayMs: ENQUEUE_DELAY_MAX_MS + 1 }).success).toBe(false)
        expect(enqueueOptionsSchema.safeParse({ priority: 1 }).success).toBe(false)
    })
})
