import { Test } from "@nestjs/testing"
import { workOriginOf } from "./automation-ports.policy"
const SUBJECT = Symbol("automation-ports.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { workOriginOf } }],
    }).compile()
    return moduleRef.get<typeof import("./automation-ports.policy")>(SUBJECT)
}

describe("automation-ports policy", () => {
    it("keeps a simulated origin simulated and treats every other origin as live", async () => {
        const subject = await build()

        expect(subject.workOriginOf("simulated")).toBe("simulated")
        expect(subject.workOriginOf("live")).toBe("live")
        expect(subject.workOriginOf("webhook")).toBe("live")
    })
})
