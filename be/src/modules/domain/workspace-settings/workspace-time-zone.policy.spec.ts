import { Test } from "@nestjs/testing"
import { timeZoneOrDefault } from "./workspace-time-zone.policy"

const SUBJECT = Symbol("workspace-time-zone.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { timeZoneOrDefault } }],
    }).compile()
    return moduleRef.get<{ timeZoneOrDefault: typeof timeZoneOrDefault }>(SUBJECT)
}

describe("the time zone of a workspace", () => {
    it("is the stored IANA name when the platform knows it", async () => {
        const policy = await build()
        expect(policy.timeZoneOrDefault("Asia/Bangkok", "Asia/Ho_Chi_Minh")).toBe("Asia/Bangkok")
    })

    it("is the default when nothing is stored, the value is not text, or the name is unknown", async () => {
        const policy = await build()
        expect(policy.timeZoneOrDefault(undefined, "Asia/Ho_Chi_Minh")).toBe("Asia/Ho_Chi_Minh")
        expect(policy.timeZoneOrDefault(7, "Asia/Ho_Chi_Minh")).toBe("Asia/Ho_Chi_Minh")
        expect(policy.timeZoneOrDefault("Mars/Olympus", "Asia/Ho_Chi_Minh")).toBe("Asia/Ho_Chi_Minh")
    })
})
