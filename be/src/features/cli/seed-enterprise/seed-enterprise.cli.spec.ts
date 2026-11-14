import { MODULE_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import { CommandRunner } from "nest-commander"
import { CliModule } from "../cli.module"
import { SeedEnterpriseCli } from "./seed-enterprise.cli"

/** The module class an import of the cli module names: itself, or the `module` of a dynamic module. */
const moduleOf = (entry: unknown): unknown =>
    entry !== null && typeof entry === "object" && "module" in entry ? entry.module : entry

/** The metadata list a module class holds under the key, or none. */
const listOf = (target: unknown, key: string): ReadonlyArray<unknown> => {
    if (typeof target !== "function") return []
    const list: unknown = Reflect.getMetadata(key, target)
    return Array.isArray(list) ? list : []
}

/** The class names of every command the cli module registers: the providers of its groups that extend `CommandRunner`. */
const registeredCommandNames = (): ReadonlyArray<string> =>
    listOf(CliModule, MODULE_METADATA.IMPORTS).flatMap((group) =>
        listOf(moduleOf(group), MODULE_METADATA.PROVIDERS).flatMap((provider) =>
            typeof provider === "function" && provider.prototype instanceof CommandRunner ? [provider.name] : [],
        ),
    )

describe("SeedEnterpriseCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [SeedEnterpriseCli] }).compile()
        const group = moduleRef.get(SeedEnterpriseCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })

    it("shares no command class name with any other command of the cli, since nest-commander matches a sub-command by its class name", () => {
        const names = registeredCommandNames()

        expect(names).toEqual(expect.arrayContaining(["SeedEnterpriseCli", "EnterpriseRunCli", "EnterpriseRemoveCli"]))
        expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([])
    })
})
