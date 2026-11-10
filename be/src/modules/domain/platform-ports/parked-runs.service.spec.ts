import { Test } from "@nestjs/testing"
import { ParkedRunsService } from "./parked-runs.service"

const ASKER = { workspaceId: "w1", memberId: "m1", locale: "vi" } as const

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ParkedRunsService] }).compile()
    return moduleRef.get(ParkedRunsService).portFor(ASKER)
}

describe("ParkedRunsService", () => {
    it("lists no parked run: the engine parks none", async () => {
        const port = await build()
        await expect(port.list({}, 20)).resolves.toEqual({ total: 0, rows: [] })
        await expect(port.list({ module: "sales", subjectId: "o1" }, 1)).resolves.toEqual({ total: 0, rows: [] })
    })

    it("knows no run and resumes none", async () => {
        const port = await build()
        await expect(port.find("r1")).resolves.toBeNull()
        await expect(port.resume("r1")).resolves.toBe(false)
    })
})
