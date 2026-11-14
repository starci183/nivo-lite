import { BrainModule } from "./brain.module"
import { BrainGraphService } from "./brain-graph.service"
import { BrainService } from "./brain.service"

describe("BrainModule graph only (the mcp app: the truths in force read by words, nothing that writes or derives)", () => {
    it("registers the graph read alone", () => {
        const module = BrainModule.register({ graphOnly: true })
        const providers = module.providers ?? []

        expect(providers).toContain(BrainGraphService)
        expect(providers).not.toContain(BrainService)
        expect(module.exports).toEqual([BrainGraphService])
    })
})
