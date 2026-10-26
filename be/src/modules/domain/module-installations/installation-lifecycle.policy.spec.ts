import { Test } from "@nestjs/testing"
import { lifecycleOf as realLifecycleOf } from "./installation-lifecycle.policy"
import type { InstallationStatus } from "./module-installations.contracts"

const SUBJECT = Symbol("installation-lifecycle.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { lifecycleOf: realLifecycleOf } }],
    }).compile()
    return moduleRef.get<{ lifecycleOf: typeof realLifecycleOf }>(SUBJECT)
}

const factsOf = (status: InstallationStatus, liveEnabled: boolean, version: string | null = "v-1") => ({
    status,
    liveEnabled,
    activeContextVersionId: version,
})

describe("lifecycleOf", () => {
    it.each<InstallationStatus>(["installing", "setup", "ready", "live", "paused", "needs_connection"])(
        "needs setup without an applied version, whatever the stored status is (%s)",
        async (status) => {
            const { lifecycleOf } = await buildSubject()
            expect(lifecycleOf(factsOf(status, true, null), 0)).toBe("needs_setup")
        },
    )

    it("is removed whatever else is stored", async () => {
        const { lifecycleOf } = await buildSubject()
        expect(lifecycleOf(factsOf("removed", true, null), 2)).toBe("removed")
        expect(lifecycleOf(factsOf("removed", false), 0)).toBe("removed")
    })

    it("reads the owner's pause before anything else", async () => {
        const { lifecycleOf } = await buildSubject()
        expect(lifecycleOf(factsOf("paused", false), 2)).toBe("paused")
    })

    it("waits for a connection while a required one is missing, even when stored as live", async () => {
        const { lifecycleOf } = await buildSubject()
        expect(lifecycleOf(factsOf("live", true), 1)).toBe("needs_connection")
        expect(lifecycleOf(factsOf("ready", false), 1)).toBe("needs_connection")
    })

    it("is running only when applied, connected and switched on", async () => {
        const { lifecycleOf } = await buildSubject()
        expect(lifecycleOf(factsOf("live", true), 0)).toBe("running")
        expect(lifecycleOf(factsOf("needs_connection", true), 0)).toBe("running")
    })

    it("is ready when applied and connected but not switched on", async () => {
        const { lifecycleOf } = await buildSubject()
        expect(lifecycleOf(factsOf("ready", false), 0)).toBe("ready")
        expect(lifecycleOf(factsOf("live", false), 0)).toBe("ready")
        expect(lifecycleOf(factsOf("needs_connection", false), 0)).toBe("ready")
    })
})
