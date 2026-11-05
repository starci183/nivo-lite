import { Test } from "@nestjs/testing"
import { EntitySchemaCli } from "./entity-schema.cli"

describe("EntitySchemaCli", () => {
    it("shows the help of the group when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [EntitySchemaCli] }).compile()
        const group = moduleRef.get(EntitySchemaCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
