import { QUERY_BOUNDS } from "@nivo-lite/agent-sdk/query"
import { RUNS_PAGE, RUNS_PAGE_MAX } from "./platform/reads/agent-runs.read"
import { STEPS_PAGE } from "./platform/reads/agent-run.read"
import { MODULE_DECLARATIONS } from "./module-declarations"

describe("the page sizes of the declared reads", () => {
    it("never ask the engine for a page over its bound, which refuses the whole read", () => {
        const sizes = MODULE_DECLARATIONS.flatMap((declaration) =>
            declaration.reads.flatMap((read) => (read.listing?.kind === "list" ? [read.listing.shape.page.size] : [])),
        )
        expect(sizes.length).toBeGreaterThan(0)
        expect(sizes.every((size) => size <= QUERY_BOUNDS.pageSize)).toBe(true)
        expect([RUNS_PAGE, RUNS_PAGE_MAX, STEPS_PAGE].every((size) => size <= QUERY_BOUNDS.pageSize)).toBe(true)
    })
})
