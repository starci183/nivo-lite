import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ModulesService } from "@modules/domain/modules"
import { EnsureSeedModulesCli } from "./ensure.cli"

/** Builds the command over a modules double whose `ensure` was set up by `setup`. */
const build = async (setup: (modules: ReturnType<typeof mock<ModulesService>>) => void) => {
    const modules = mock<ModulesService>()
    setup(modules)
    const moduleRef = await Test.createTestingModule({
        providers: [EnsureSeedModulesCli, { provide: ModulesService, useValue: modules }],
    }).compile()
    return { command: moduleRef.get(EnsureSeedModulesCli), modules }
}

describe("EnsureSeedModulesCli", () => {
    it("hands the process output to the modules and answers what they answer", async () => {
        const { command, modules } = await build((double) => double.ensure.mockResolvedValue(undefined))

        await expect(command.run()).resolves.toBeUndefined()

        expect(modules.ensure).toHaveBeenCalledWith(process.stdout)
    })

    it("lets the failure of the modules reach the exit code", async () => {
        const { command } = await build((double) => double.ensure.mockRejectedValue(new Error("unresolved")))

        await expect(command.run()).rejects.toThrow("unresolved")
    })
})
