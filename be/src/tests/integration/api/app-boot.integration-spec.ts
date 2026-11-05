import { AppModule } from "../../../../apps/api/src/app.module"
import { API_APP_MODULES } from "../../world/api-app.options"
import { useTestWorld } from "../../world/use-test-world"

/** How long the real AppModule may take to open on the world; a provider cycle Nest does not report never resolves at all, and the test timeout is the deadline that fails it. */
const BOOT_DEADLINE_MS = 60_000

jest.setTimeout(BOOT_DEADLINE_MS)

const world = useTestWorld({ modules: API_APP_MODULES })

describe("AppModule boot", () => {
    it("opens the real AppModule on the test world within the deadline, so a provider cycle cannot hang the boot silently", () => {
        expect(world.resolve(AppModule)).toBeInstanceOf(AppModule)
    })
})
