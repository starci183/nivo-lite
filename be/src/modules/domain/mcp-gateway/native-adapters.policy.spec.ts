import { Test } from "@nestjs/testing"
import type { NativeAdapter } from "./mcp-gateway.contracts"
import { withoutShadowed } from "./native-adapters.policy"

/** The members of the subject under test. */
interface Subject {
    readonly withoutShadowed: typeof withoutShadowed
}

const SUBJECT = Symbol("native-adapters.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { withoutShadowed } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const adapter = (key: string): NativeAdapter => ({
    manifest: { key, name: key, kind: "native", contractVersion: `${key}@1`, tools: [] },
    invoke: () => Promise.resolve({}),
})

describe("native-adapters.policy", () => {
    it("keeps every adapter when no two share a key", async () => {
        const subject = await build()
        const [sepay, einvoice, brain] = [adapter("sepay"), adapter("einvoice"), adapter("brain")]

        expect(subject.withoutShadowed([sepay, einvoice, brain])).toStrictEqual([sepay, einvoice, brain])
    })

    it("gives the place of a default to the adapter that comes later under the same key", async () => {
        const subject = await build()
        const [sepay, einvoice, brain, richer] = [
            adapter("sepay"),
            adapter("einvoice"),
            adapter("brain"),
            adapter("sepay"),
        ]

        const kept = subject.withoutShadowed([sepay, einvoice, brain, richer])

        expect(kept).toHaveLength(3)
        expect(kept[0]).toBe(richer)
        expect(kept[1]).toBe(einvoice)
        expect(kept[2]).toBe(brain)
    })

    it("answers none for none", async () => {
        const subject = await build()

        expect(subject.withoutShadowed([])).toStrictEqual([])
    })
})
