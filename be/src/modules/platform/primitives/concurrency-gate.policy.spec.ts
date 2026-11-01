import { Test } from "@nestjs/testing"
import { concurrencyGateOf } from "./concurrency-gate.policy"

const SUBJECT = Symbol("concurrency-gate.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { concurrencyGateOf } }],
    }).compile()
    return moduleRef.get<{ concurrencyGateOf: typeof concurrencyGateOf }>(SUBJECT).concurrencyGateOf
}

/** A piece of work the test settles by hand. */
interface Held {
    readonly done: Promise<string>
    release(): void
    fail(cause: Error): void
}

const hold = (): Held => {
    const hooks: Pick<Held, "release" | "fail"> = { release: () => undefined, fail: () => undefined }
    const done = new Promise<string>((resolve, reject) => {
        hooks.release = () => resolve("done")
        hooks.fail = reject
    })
    return { done, release: () => hooks.release(), fail: (cause) => hooks.fail(cause) }
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe("concurrencyGateOf", () => {
    it("runs at most `limit` pieces of work at once and starts the next in arrival order when a place is free", async () => {
        const gate = (await build())(2)
        const started: Array<string> = []
        const works = ["a", "b", "c"].map((name) => ({ name, held: hold() }))
        const results = works.map((one) =>
            gate.run(() => {
                started.push(one.name)
                return one.held.done
            }),
        )
        await tick()
        expect(started).toEqual(["a", "b"])

        works[0]?.held.release()
        await tick()
        expect(started).toEqual(["a", "b", "c"])

        works[1]?.held.release()
        works[2]?.held.release()
        await expect(Promise.all(results)).resolves.toEqual(["done", "done", "done"])
    })

    it("gives the place back when the work throws, and passes the failure on", async () => {
        const gate = (await build())(1)
        const first = hold()
        const failed = gate.run(() => first.done)
        const second = gate.run(() => Promise.resolve("second"))
        first.fail(new Error("model down"))

        await expect(failed).rejects.toThrow("model down")
        await expect(second).resolves.toBe("second")
        await expect(gate.run(() => Promise.resolve("third"))).resolves.toBe("third")
    })

    it("reads a limit below one as one", async () => {
        const gate = (await build())(0)
        const first = hold()
        const started: Array<string> = []
        const one = gate.run(() => first.done)
        const two = gate.run(() => {
            started.push("two")
            return Promise.resolve("two")
        })
        await tick()
        expect(started).toEqual([])

        first.release()
        await one
        await expect(two).resolves.toBe("two")
    })
})
