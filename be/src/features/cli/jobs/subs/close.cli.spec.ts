import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ParkedJobCloseService } from "@modules/platform/jobs"
import { CloseJobsCli } from "./close.cli"

const JOB = "2d7314f3-50ce-4c41-820a-2ba6902be647"

const build = async () => {
    const closer = mock<ParkedJobCloseService>()
    closer.closeFor.mockResolvedValue(undefined)
    const entityManager = mockEntityManager({})
    const moduleRef = await Test.createTestingModule({
        providers: [
            CloseJobsCli,
            { provide: ParkedJobCloseService, useValue: closer },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { cli: moduleRef.get(CloseJobsCli), closer, entityManager }
}

describe("CloseJobsCli", () => {
    it("hands the first argument, the reason, stdout, the process and the primary connection to the closer", async () => {
        const { cli, closer, entityManager } = await build()

        await cli.run([JOB], { reason: "old test payment" })

        expect(closer.closeFor).toHaveBeenCalledWith(process.stdout, process, entityManager, JOB, "old test payment")
    })

    it("hands over no id and no reason when the command line gave none", async () => {
        const { cli, closer, entityManager } = await build()

        await cli.run([])

        expect(closer.closeFor).toHaveBeenCalledWith(process.stdout, process, entityManager, undefined, undefined)
    })

    it("answers the reason option as it was typed", async () => {
        const { cli } = await build()

        expect(cli.parseReason("x y")).toBe("x y")
    })
})
