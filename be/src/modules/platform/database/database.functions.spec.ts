import { mockEntityManager } from "@starci/jest-preset"
import { advisoryXactLock, callDbFunction, notify } from "./database.functions"

describe("callDbFunction", () => {
    it("selects from the function with one numbered placeholder per argument and answers its rows", async () => {
        const rows = [{ id: "a", state: "queued" }]
        const em = mockEntityManager({ query: ["SELECT * FROM public.job_status($1, $2, $3)", rows] })

        const answered = await callDbFunction(em, "public.job_status", ["ws", "q", "key"])

        expect(answered).toBe(rows)
        expect(em.query).toHaveBeenCalledWith("SELECT * FROM public.job_status($1, $2, $3)", ["ws", "q", "key"])
    })

    it("calls a function with no argument with an empty parameter list", async () => {
        const em = mockEntityManager({ query: ["SELECT * FROM public.job_stats()", [{ job_stats: {} }]] })

        await callDbFunction(em, "public.job_stats", [])

        expect(em.query).toHaveBeenCalledWith("SELECT * FROM public.job_stats()", [])
    })

    it("passes null and array arguments through as parameters, never into the statement text", async () => {
        const em = mockEntityManager({ query: ["SELECT * FROM fn($1, $2)", []] })
        const args = [null, ["x", "y"]]

        await callDbFunction(em, "fn", args)

        expect(em.query).toHaveBeenCalledWith("SELECT * FROM fn($1, $2)", args)
    })

    it.each(["", "fn()", "fn; select 1", "Public.fn", "a.b.c", "1fn", "public.", "fn name", "public.fn--"])(
        "refuses the name %j and sends no statement",
        async (name) => {
            const em = mockEntityManager()

            await expect(callDbFunction(em, name, [1])).rejects.toThrow(
                new TypeError(`${name} is not a database function name`),
            )

            expect(em.query).not.toHaveBeenCalled()
        },
    )
})

describe("advisoryXactLock", () => {
    it("locks the 64-bit hash of the key for the transaction", async () => {
        const em = mockEntityManager({ query: ["SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", []] })

        await expect(advisoryXactLock(em, "topic:a")).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["topic:a"])
    })
})

describe("notify", () => {
    it("sends the payload on the channel through pg_notify with both as parameters", async () => {
        const em = mockEntityManager({ query: ["SELECT pg_notify($1, $2)", []] })

        await expect(notify(em, "hub", '{"seq":"1"}')).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith("SELECT pg_notify($1, $2)", ["hub", '{"seq":"1"}'])
    })
})
