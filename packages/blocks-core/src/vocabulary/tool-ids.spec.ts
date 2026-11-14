import { isToolId } from "@nivo-lite/agent-sdk/schema"
import { TOOL } from "./tool-ids"

/**
 * The three-level rename (2026-11-12): every NIVO tool id obeys the law `nivo.tool.<1-4 segments>`. That no OLD id is written anywhere
 * in the repository is a source check, not a spec (`npm run tool-names:check`, scripts/tool-names-check.mjs).
 */
describe("tool ids after the three-level rename", () => {
    it("names every tool by the law of a NIVO tool id", () => {
        const unlawful = Object.values(TOOL).filter((id) => !isToolId(id))

        expect(unlawful).toEqual([])
    })

    it("keeps no old constant name: no two names of TOOL hold the same id", () => {
        const names = Object.entries(TOOL)
        const shared = names
            .filter(([name, id]) => names.some(([other, otherId]) => other !== name && otherId === id))
            .map(([name]) => name)

        expect(shared).toEqual([])
    })

    it("names each tool once", () => {
        const ids = Object.values(TOOL)

        expect(new Set(ids).size).toBe(ids.length)
    })
})
