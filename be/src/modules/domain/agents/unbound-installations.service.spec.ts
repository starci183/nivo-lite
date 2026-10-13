import { Test } from "@nestjs/testing"
import { UnboundInstallationsService } from "./unbound-installations.service"

const setup = async (): Promise<UnboundInstallationsService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [UnboundInstallationsService],
    }).compile()
    return moduleRef.get(UnboundInstallationsService)
}

describe("UnboundInstallationsService", () => {
    it("has no installation by id", async () => {
        const subject = await setup()

        await expect(subject.byId()).resolves.toBeNull()
    })

    it("has no first installation for a module", async () => {
        const subject = await setup()

        await expect(subject.firstOfModule()).resolves.toBeNull()
    })

    it("has no installation for an agent", async () => {
        const subject = await setup()

        await expect(subject.ofAgent()).resolves.toBeNull()
    })

    it("has no installations running on OpenClaw", async () => {
        const subject = await setup()

        await expect(subject.onOpenclaw()).resolves.toEqual([])
    })

    it("has no context version for an installation", async () => {
        const subject = await setup()

        await expect(subject.contextVersionOf()).resolves.toBeNull()
    })
})
