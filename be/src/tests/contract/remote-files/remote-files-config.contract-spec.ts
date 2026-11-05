import { parseRemoteFilesConfig } from "@modules/integrations/remote-files"
import { EnvSource } from "@modules/platform/config"

describe("parseRemoteFilesConfig", () => {
    it("defaults to 10 MiB, a 15 second deadline and three redirects", () => {
        expect(parseRemoteFilesConfig(new EnvSource({}))).toEqual({
            maxBytes: 10 * 1024 * 1024,
            timeoutMs: 15_000,
            maxRedirects: 3,
        })
    })

    it("reads the size, the deadline and the redirects from the environment", () => {
        const env = new EnvSource({
            REMOTE_FILES_MAX_BYTES: "2048",
            REMOTE_FILES_TIMEOUT: "5s",
            REMOTE_FILES_MAX_REDIRECTS: "1",
        })

        expect(parseRemoteFilesConfig(env)).toEqual({ maxBytes: 2048, timeoutMs: 5000, maxRedirects: 1 })
    })
})
