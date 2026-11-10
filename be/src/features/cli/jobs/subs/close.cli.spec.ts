import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ParkedJobCloseService } from "@modules/platform/jobs"
import { CloseJobsCli } from "./close.cli"

const JOB = "2d7314f3-50ce-4c41-820a-2ba6902be647"

const build = async () => {
    const closer = mock<ParkedJobCloseService>()
    closer.close.mockResolvedValue(true)
    const entityManager = mockEntityManager({})
    const moduleRef = await Test.createTestingModule({
        providers: [
            CloseJobsCli,
            { provide: ParkedJobCloseService, useValue: closer },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    const write = jest.spyOn(process.stdout, "write").mockReturnValue(true)
    return { cli: moduleRef.get(CloseJobsCli), closer, entityManager, write }
}

describe("CloseJobsCli", () => {
    afterEach(() => {
        process.exitCode = 0
        jest.restoreAllMocks()
    })

    it("closes the parked job of the id with the reason, on the primary connection, and says so", async () => {
        const { cli, closer, entityManager, write } = await build()

        await cli.run([JOB], { reason: "  old test payment  " })

        expect(closer.close).toHaveBeenCalledWith(entityManager, JOB, "old test payment")
        expect(write).toHaveBeenCalledWith(`closed ${JOB}\n`)
        expect(process.exitCode).not.toBe(1)
    })

    it("fails and says so for a job that is not parked", async () => {
        const { cli, closer, write } = await build()
        closer.close.mockResolvedValue(false)

        await cli.run([JOB], { reason: "why" })

        expect(write).toHaveBeenCalledWith(`not a parked job: ${JOB}\n`)
        expect(process.exitCode).toBe(1)
    })

    it.each([
        ["an id that is no job id", ["not-a-uuid"], { reason: "why" }, "not a job id: not-a-uuid\n"],
        ["no id", [], { reason: "why" }, "not a job id: \n"],
        ["no reason", [JOB], { reason: "  " }, 'a reason is required: --reason "<why>"\n'],
        ["no options at all", [JOB], undefined, 'a reason is required: --reason "<why>"\n'],
    ])("closes nothing and fails for %s", async (_what, params, options, said) => {
        const { cli, closer, write } = await build()

        await cli.run(params, options)

        expect(closer.close).not.toHaveBeenCalled()
        expect(write).toHaveBeenCalledWith(said)
        expect(process.exitCode).toBe(1)
    })

    it("answers the reason option as it was typed", async () => {
        const { cli } = await build()

        expect(cli.parseReason("x y")).toBe("x y")
    })
})
