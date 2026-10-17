import { Test } from "@nestjs/testing"
import { channelOf } from "./supplier-channel.policy"

const SUBJECT = Symbol("supplier-channel.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { channelOf } }],
    }).compile()
    return moduleRef.get<typeof import("./supplier-channel.policy")>(SUBJECT)
}

describe("channelOf", () => {
    it("keeps Zalo and phone", async () => {
        const subject = await buildSubject()

        expect(subject.channelOf("zalo")).toBe("zalo")
        expect(subject.channelOf("phone")).toBe("phone")
    })

    it("reads anything else as email", async () => {
        const subject = await buildSubject()

        expect(subject.channelOf("email")).toBe("email")
        expect(subject.channelOf("fax")).toBe("email")
    })
})
