import { Test } from "@nestjs/testing"
import { newPassword } from "./workspace-seed.policy"
const SUBJECT = Symbol("workspace-seed.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { newPassword } }],
    }).compile()
    return moduleRef.get<typeof import("./workspace-seed.policy")>(SUBJECT)
}

describe("workspace-seed policy", () => {
    it("makes 24 url safe characters, never the same twice", async () => {
        const subject = await build()

        const first = subject.newPassword()

        expect(first).toMatch(/^[\w-]{24}$/)
        expect(subject.newPassword()).not.toBe(first)
    })
})
