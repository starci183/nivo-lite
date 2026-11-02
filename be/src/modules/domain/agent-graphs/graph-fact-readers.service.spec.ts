import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphFactReadersService } from "./graph-fact-readers.service"
import type { GraphFactReader } from "./agent-graphs.port"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [GraphFactReadersService] }).compile()
    return moduleRef.get(GraphFactReadersService)
}

describe("GraphFactReadersService", () => {
    it("offers a stable empty view before the configured reader dependencies finish construction", async () => {
        const service = await build()
        const view = service.all()
        expect(view).toEqual([])
        expect(service.all()).toBe(view)
    })

    it("populates the same view with the actual configured providers without copying or invoking them", async () => {
        const service = await build()
        const view = service.all()
        const first = mock<GraphFactReader>()
        const second = mock<GraphFactReader>()
        expect(service.register([first, second])).toBe(view)
        expect(view).toEqual([first, second])
        expect(first.read).not.toHaveBeenCalled()
        expect(second.read).not.toHaveBeenCalled()
    })

    it("reconciles a repeated composition into the existing view rather than accumulating duplicate readers", async () => {
        const service = await build()
        const view = service.all()
        const reader = mock<GraphFactReader>()
        service.register([reader])
        expect(service.register([])).toBe(view)
        expect(view).toEqual([])
    })
})
