import { EnvSource } from "@modules/platform/config"
import { parseQdrantConfig } from "./qdrant.config"

describe("parseQdrantConfig: the vector index is a required engine piece", () => {
    it("refuses a deployment without QDRANT_URL: there is no other store of vectors to fall back to", () => {
        expect(() => parseQdrantConfig(new EnvSource({}))).toThrow(expect.objectContaining({ code: "CONFIG_KEY_MISSING" }))
    })

    it("reads the address without a trailing slash, the sealed key when declared, and the call timeout", () => {
        const config = parseQdrantConfig(new EnvSource({ QDRANT_URL: "http://nivo-qdrant:6333/", QDRANT_TIMEOUT: "2s" }))

        expect(config).toEqual({ url: "http://nivo-qdrant:6333", apiKey: null, timeoutMs: 2000 })
    })
})
