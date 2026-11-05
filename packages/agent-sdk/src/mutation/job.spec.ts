import { z } from "../schema/zod-entry"
import { defineJob, JOB_ATTEMPTS_MAX, jobProblems } from "./job"
import type { JobContext } from "./job"
import { JobDefinitionError } from "./job-definition-error"
import { doorPort } from "./door-port"
import type { DoorApi } from "./door-port"

const input = z.object({ orderId: z.uuid(), channel: z.enum(["zalo", "web"]), memo: z.string().max(100) })

describe("jobProblems", () => {
    it("accepts ids, enums, literals and bounded texts, optional or null", () => {
        const sound = z.object({
            a: z.uuid(),
            b: z.guid().optional(),
            c: z.enum(["x"]).nullable(),
            d: z.literal("k"),
            e: z.string().max(200),
        })
        expect(jobProblems({ name: "demo.send", input: sound, attempts: 3 })).toEqual([])
    })

    it("refuses a malformed name", () => {
        expect(jobProblems({ name: "send", input, attempts: 3 })).toEqual([{ code: "JOB_NAME_MALFORMED", at: "send" }])
    })

    it("refuses a payload member that is not an id, an enum or a bounded text", () => {
        const bad = z.object({
            free: z.string(),
            long: z.string().max(201),
            amount: z.number(),
            nested: z.object({ a: z.uuid() }),
        })
        expect(jobProblems({ name: "demo.send", input: bad, attempts: 1 }).map((p) => p.at)).toEqual([
            "demo.send.free",
            "demo.send.long",
            "demo.send.amount",
            "demo.send.nested",
        ])
    })

    it("refuses attempts off 1 to the maximum, and a fraction", () => {
        for (const attempts of [0, JOB_ATTEMPTS_MAX + 1, 1.5, Number.NaN]) {
            expect(jobProblems({ name: "demo.send", input, attempts })).toEqual([
                { code: "JOB_ATTEMPTS_INVALID", at: "demo.send" },
            ])
        }
        expect(jobProblems({ name: "demo.send", input, attempts: JOB_ATTEMPTS_MAX })).toEqual([])
    })
})

describe("defineJob", () => {
    const context: JobContext = { workspaceId: "w", attempt: 1, effectKey: (step) => `demo.send:${step}` }

    it("returns the frozen declaration with its entry and a run that gets its ports", async () => {
        const calls: Array<string> = []
        const door: DoorApi = {
            call: (tool) => {
                calls.push(tool)
                return Promise.resolve({ ok: true, output: null })
            },
        }
        const job = defineJob({
            name: "demo.send",
            input,
            ports: { door: doorPort },
            attempts: 3,
            run: async (ports, value, ctx) => {
                await ports.door.call("chat.zalo.send", { to: value.orderId, key: ctx.effectKey("send") })
            },
        })
        expect(job.entry).toBe("job")
        await job.run({ door }, { orderId: "0d9e5a64-3f6a-4f0b-9a54-3d1a7a0b8c11", channel: "zalo", memo: "" }, context)
        expect(calls).toEqual(["chat.zalo.send"])
    })

    it("throws the first problem at definition", () => {
        const attempt = (): unknown =>
            defineJob({ name: "send", input, ports: {}, attempts: 0, run: () => Promise.resolve() })
        expect(attempt).toThrow(JobDefinitionError)
        expect(attempt).toThrow("JOB_NAME_MALFORMED: send")
    })
})
