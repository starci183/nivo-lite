import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CreateOwnerCli } from "./create-owner.cli"
import { RunCreateOwnerCli } from "./subs/run.cli"
import { OwnersService } from "@modules/domain/owners"

describe("CreateOwnerCli", () => {
    it("shows the help of its group when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                CreateOwnerCli,
                { provide: RunCreateOwnerCli, useValue: mock<RunCreateOwnerCli>() },
                { provide: OwnersService, useValue: mock<OwnersService>() },
            ],
        }).compile()
        const group = moduleRef.get(CreateOwnerCli)
        const help = jest.fn().mockResolvedValue(undefined)
        Object.assign(group, { command: { help } })

        await expect(group.run()).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
