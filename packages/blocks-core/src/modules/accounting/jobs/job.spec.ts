import { z } from "zod"
import { DONE, defineJob, resultOf } from "./job"

describe("job", () => {
    it("defines a job as its config with the registry tag", () => {
        const input = z.object({ id: z.uuid() })
        const job = defineJob({
            name: "accounting.noop",
            input,
            ports: {},
            attempts: 3,
            run: () => Promise.resolve(DONE),
        })
        expect(job.entry).toBe("job")
        expect(job.name).toBe("accounting.noop")
        expect(job.attempts).toBe(3)
    })

    it("finishes a job whose door call went through", () => {
        expect(resultOf("ledger.append", { ok: true, output: { ref: "A2" } })).toEqual({ ok: true })
    })

    it("fails a job with the tool and the reason, transient only when the door says transient", () => {
        expect(resultOf("chat.send", { ok: false, reason: "transient", message: "503" })).toEqual({
            ok: false,
            tool: "chat.send",
            reason: "transient",
            transient: true,
        })
        expect(resultOf("chat.send", { ok: false, reason: "forbidden", message: "403" })).toEqual({
            ok: false,
            tool: "chat.send",
            reason: "forbidden",
            transient: false,
        })
    })
})
