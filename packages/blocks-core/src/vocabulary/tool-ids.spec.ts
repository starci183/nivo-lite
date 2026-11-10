import { TOOL } from "./tool-ids"

/**
 * The tool-name flip (2026-11-12): every NIVO tool id carries its final name. That no OLD id is written anywhere in the repository is
 * a source check, not a spec (`npm run tool-names:check`, scripts/tool-names-check.mjs).
 */
describe("tool ids after the nivo flip", () => {
    it("names every NIVO tool nivo.<domain>.<object>.<verb>", () => {
        const unprefixed = Object.values(TOOL).filter((id) => !id.startsWith("nivo."))

        expect(unprefixed).toEqual([])
    })

    it("keeps every id to two or three lower-case parts after the prefix", () => {
        const malformed = Object.values(TOOL).filter((id) => !/^nivo(\.[a-z][a-z0-9-]*){2,3}$/u.test(id))

        expect(malformed).toEqual([])
    })

    it("names each tool once", () => {
        const ids = Object.values(TOOL)

        expect(new Set(ids).size).toBe(ids.length)
    })
})
