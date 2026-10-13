import { isValidPort, PUBLIC_MAIL_PORTS } from "./smtp-target.policy"

describe("smtp-target policy", () => {
    describe("isValidPort", () => {
        it("accepts 1 to 65535 and refuses the rest", () => {
            expect(isValidPort(587)).toBe(true)
            expect(isValidPort(1)).toBe(true)
            expect(isValidPort(65535)).toBe(true)
            expect(isValidPort(0)).toBe(false)
            expect(isValidPort(65536)).toBe(false)
            expect(isValidPort(25.5)).toBe(false)
        })
    })

    it("lists the public mail ports", () => {
        expect([...PUBLIC_MAIL_PORTS]).toEqual([25, 465, 587, 2465, 2525, 2587])
    })
})
