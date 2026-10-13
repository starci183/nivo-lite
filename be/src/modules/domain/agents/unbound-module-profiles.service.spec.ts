import { Test } from "@nestjs/testing"
import { UnboundModuleProfilesService } from "./unbound-module-profiles.service"

const setup = async (): Promise<UnboundModuleProfilesService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [UnboundModuleProfilesService],
    }).compile()
    return moduleRef.get(UnboundModuleProfilesService)
}

describe("UnboundModuleProfilesService", () => {
    it("has no module knowledge folder", async () => {
        const subject = await setup()

        expect(subject.knowledgeFolderOf()).toBeNull()
    })

    it("has no module reply contract", async () => {
        const subject = await setup()

        expect(subject.replyContractOf()).toBeNull()
    })

    it("adds no application clause to a prompt", async () => {
        const subject = await setup()

        expect(subject.applicationClause()).toBe("")
    })

    it("adds no application shape to a prompt", async () => {
        const subject = await setup()

        expect(subject.applicationShape()).toBe("")
    })
})
