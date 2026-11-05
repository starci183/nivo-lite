import { installationPort, membersPort } from "./ports"

describe("the ports of the platform module", () => {
    it("are registered under ids of the platform, one each", () => {
        expect(installationPort.id).toBe("platform.installation")
        expect(membersPort.id).toBe("platform.members")
    })
})
