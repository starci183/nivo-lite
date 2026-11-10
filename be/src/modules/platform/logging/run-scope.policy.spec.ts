import { Test } from "@nestjs/testing"
import { runInScope, withRunScope } from "./run-scope.policy"

const SUBJECT = Symbol("run-scope.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runInScope, withRunScope } }],
    }).compile()
    return moduleRef.get<{ runInScope: typeof runInScope; withRunScope: typeof withRunScope }>(SUBJECT)
}

/** Lets `turns` microtask rounds pass, so two scopes overlap. */
const later = async (turns: number): Promise<void> => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve()
}

describe("run scope", () => {
    it("holds the run through awaited work and nowhere else", async () => {
        const scoped = await build()
        expect(scoped.runInScope()).toBeNull()

        const seen = await scoped.withRunScope("run-1", async () => {
            await later(2)
            return scoped.runInScope()
        })

        expect(seen).toBe("run-1")
        expect(scoped.runInScope()).toBeNull()
    })

    it("keeps two runs apart when they overlap", async () => {
        const scoped = await build()
        const read = (runId: string, turns: number): Promise<string | null> =>
            scoped.withRunScope(runId, async () => {
                await later(turns)
                return scoped.runInScope()
            })

        await expect(Promise.all([read("a", 6), read("b", 1)])).resolves.toEqual(["a", "b"])
    })
})
