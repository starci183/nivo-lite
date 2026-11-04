import { Test } from "@nestjs/testing"
import { buildWiringProof } from "../../fixtures/builders/api.builder"
import { AppModule } from "../../../../apps/api/src/app.module"

/** How long the real AppModule may take to resolve its providers; a provider cycle Nest does not report never resolves at all. */
const COMPILE_DEADLINE_MS = 60_000

/** A promise that rejects once the deadline passes, and the handle that cancels it. */
const deadlineOf = (ms: number): { readonly expired: Promise<never>; readonly cancel: () => void } => {
    let handle: NodeJS.Timeout | undefined
    const expired = new Promise<never>((_resolve, reject) => {
        handle = setTimeout(() => reject(new Error(`AppModule did not compile within ${String(ms)} ms`)), ms)
    })
    return { expired, cancel: () => clearTimeout(handle) }
}

describe("AppModule boot", () => {
    it(
        "compiles the real AppModule with its infrastructure doubles within the deadline, so a provider cycle cannot hang the boot silently",
        async () => {
            const { options, overrides } = buildWiringProof(AppModule)
            const builder = Test.createTestingModule({ imports: [AppModule.register(options)] })
            for (const override of overrides) builder.overrideProvider(override.token).useValue(override.value)
            const deadline = deadlineOf(COMPILE_DEADLINE_MS)

            try {
                const compiled = await Promise.race([builder.compile(), deadline.expired])
                expect(compiled.get(AppModule)).toBeInstanceOf(AppModule)
            } finally {
                deadline.cancel()
            }
        },
        COMPILE_DEADLINE_MS + 30_000,
    )
})
