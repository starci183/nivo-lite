import { EnvSource } from "@modules/platform/config"
import { parseZaloProviderConfig } from "./zalo-provider.config"

const HOUR = 3_600_000

describe("parseZaloProviderConfig", () => {
    it("defaults to the 48 hour consultation window of Zalo and a one day stale age", () => {
        expect(parseZaloProviderConfig(new EnvSource({}))).toEqual({ replyWindowMs: 48 * HOUR, staleAfterMs: 24 * HOUR })
    })

    it("reads the window and the stale age from the environment", () => {
        const env = new EnvSource({ ZALO_REPLY_WINDOW: "12h", ZALO_STALE_AFTER: "2h" })

        expect(parseZaloProviderConfig(env)).toEqual({ replyWindowMs: 12 * HOUR, staleAfterMs: 2 * HOUR })
    })
})
