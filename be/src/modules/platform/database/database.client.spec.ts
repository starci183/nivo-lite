import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import { advisoryXactLock, callDbFunction, notify } from "./database.client"
const SUBJECT = Symbol("database.client")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { advisoryXactLock, callDbFunction, notify } }],
    }).compile()
    return moduleRef.get<typeof import("./database.client")>(SUBJECT)
}

describe("callDbFunction", () => {
    it("selects from the function with one numbered placeholder per argument and answers its rows", async () => {
        const subject = await build()
        const rows = [{ id: "a", state: "queued" }]
        const em = mockEntityManager({ query: ["SELECT * FROM public.event_bus_read($1, $2, $3)", rows] })

        const answered = await subject.callDbFunction(em, "public.event_bus_read", ["ws", "q", "key"])

        expect(answered).toBe(rows)
        expect(em.query).toHaveBeenCalledWith("SELECT * FROM public.event_bus_read($1, $2, $3)", ["ws", "q", "key"])
    })

    it("calls a function with no argument with an empty parameter list", async () => {
        const subject = await build()
        const em = mockEntityManager({ query: ["SELECT * FROM public.event_bus_dead_letters()", [{ job_stats: {} }]] })

        await subject.callDbFunction(em, "public.event_bus_dead_letters", [])

        expect(em.query).toHaveBeenCalledWith("SELECT * FROM public.event_bus_dead_letters()", [])
    })

    it("passes null and array arguments through as parameters, never into the statement text", async () => {
        const subject = await build()
        const em = mockEntityManager({ query: ["SELECT * FROM public.event_bus_send($1, $2)", []] })
        const args = [null, ["x", "y"]]

        await subject.callDbFunction(em, "public.event_bus_send", args)

        expect(em.query).toHaveBeenCalledWith("SELECT * FROM public.event_bus_send($1, $2)", args)
    })

    it.each(["", "fn()", "fn; select 1", "Public.fn", "a.b.c", "1fn", "public.", "fn name", "public.fn--"])(
        "refuses the name %j and sends no statement",
        async (name) => {
            const subject = await build()
            const em = mockEntityManager()

            await expect(subject.callDbFunction(em, name, [1])).rejects.toThrow(
                new DatabaseError({ code: DatabaseErrorCode.FunctionRejected }),
            )

            expect(em.query).not.toHaveBeenCalled()
        },
    )
})

describe("advisoryXactLock", () => {
    it("locks the 64-bit hash of the key for the transaction", async () => {
        const subject = await build()
        const em = mockEntityManager({ query: ["SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", []] })

        await expect(subject.advisoryXactLock(em, "topic:a")).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["topic:a"])
    })
})

describe("notify", () => {
    it("sends the payload on the channel through pg_notify with both as parameters", async () => {
        const subject = await build()
        const em = mockEntityManager({ query: ["SELECT pg_notify($1, $2)", []] })

        await expect(subject.notify(em, "hub", '{"seq":"1"}')).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith("SELECT pg_notify($1, $2)", ["hub", '{"seq":"1"}'])
    })
})
