import { Test } from "@nestjs/testing"
import { isPrivateAddress, isWellFormedHost } from "./network-address.policy"
const SUBJECT = Symbol("network-address.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isPrivateAddress, isWellFormedHost } }],
    }).compile()
    return moduleRef.get<typeof import("./network-address.policy")>(SUBJECT)
}

describe("isPrivateAddress", () => {
    it.each([
        "::1",
        "::",
        "[::1]",
        "fc00::1",
        "fd12::1",
        "fe80::1",
        "fe90::1",
        "fea0::1",
        "feb0::1",
        "::ffff:10.0.0.1",
        "::ffff:127.0.0.1",
        "0.0.0.0",
        "10.1.2.3",
        "127.0.0.1",
        "[127.0.0.1]",
        "169.254.1.1",
        "172.16.0.1",
        "172.31.255.1",
        "192.168.1.1",
        "100.64.0.1",
        "100.127.0.1",
        "example.com",
        "10.1.2",
        "10.1.2.x",
    ])("treats %s as private", async (address) => {
        const subject = await build()

        expect(subject.isPrivateAddress(address)).toBe(true)
    })

    it.each([
        "8.8.8.8",
        "1.1.1.1",
        "172.15.0.1",
        "172.32.0.1",
        "100.63.0.1",
        "100.128.0.1",
        "169.253.1.1",
        "::ffff:8.8.8.8",
        "2001:4860:4860::8888",
        "fe70::1",
    ])("treats %s as public", async (address) => {
        const subject = await build()

        expect(subject.isPrivateAddress(address)).toBe(false)
    })
})

describe("isWellFormedHost", () => {
    it("accepts a DNS name and refuses an empty, dotted or oversized one", async () => {
        const subject = await build()

        expect(subject.isWellFormedHost("a")).toBe(true)
        expect(subject.isWellFormedHost("Shop.Example")).toBe(true)
        expect(subject.isWellFormedHost("a-b.example")).toBe(true)
        expect(subject.isWellFormedHost("")).toBe(false)
        expect(subject.isWellFormedHost("a..b")).toBe(false)
        expect(subject.isWellFormedHost("-ab")).toBe(false)
        expect(subject.isWellFormedHost("ab-")).toBe(false)
        expect(subject.isWellFormedHost(`${"a".repeat(63)}.${"b".repeat(189)}`)).toBe(true)
        expect(subject.isWellFormedHost("a".repeat(254))).toBe(false)
    })
})
