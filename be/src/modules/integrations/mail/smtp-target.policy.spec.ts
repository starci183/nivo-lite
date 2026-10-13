import { isPrivateAddress, isValidPort, isWellFormedHost, PUBLIC_MAIL_PORTS } from "./smtp-target.policy"

describe("smtp-target policy", () => {
    describe("isPrivateAddress", () => {
        it.each([
            "0.0.0.0",
            "10.1.2.3",
            "127.0.0.1",
            "169.254.1.1",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.1.1",
            "100.64.0.1",
            "100.127.0.1",
            "::1",
            "::",
            "[::1]",
            "fc00::1",
            "fd12::1",
            "fe80::1",
            "::ffff:10.0.0.1",
            "not-an-address",
            "1.2.3",
        ])("treats %s as private", (address) => {
            expect(isPrivateAddress(address)).toBe(true)
        })

        it.each(["8.8.8.8", "172.32.0.1", "100.128.0.1", "2001:4860:4860::8888", "::ffff:8.8.8.8", "192.169.0.1"])(
            "treats %s as public",
            (address) => {
                expect(isPrivateAddress(address)).toBe(false)
            },
        )
    })

    describe("isWellFormedHost", () => {
        it("accepts a DNS name and refuses spaces, a leading dash and consecutive dots", () => {
            expect(isWellFormedHost("smtp.gmail.com")).toBe(true)
            expect(isWellFormedHost("a")).toBe(true)
            expect(isWellFormedHost("smtp gmail.com")).toBe(false)
            expect(isWellFormedHost("-smtp.com")).toBe(false)
            expect(isWellFormedHost("smtp..com")).toBe(false)
        })
    })

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
