import { newPassword } from "./workspace-seed.policy"

describe("workspace-seed policy", () => {
    it("makes 24 url safe characters, never the same twice", () => {
        const first = newPassword()

        expect(first).toMatch(/^[\w-]{24}$/)
        expect(newPassword()).not.toBe(first)
    })
})
