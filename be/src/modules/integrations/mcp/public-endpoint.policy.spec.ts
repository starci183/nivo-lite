import dns from "node:dns/promises"
import type { LookupAddress } from "node:dns"
import { Test } from "@nestjs/testing"
import { isPublicEndpoint } from "./public-endpoint.policy"

/** The members of the subject under test. */
interface Subject {
    readonly isPublicEndpoint: typeof isPublicEndpoint
}

const SUBJECT = Symbol("public-endpoint.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isPublicEndpoint } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const answers = (...addresses: ReadonlyArray<string>): Array<LookupAddress> =>
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))

/** Makes the next lookups answer these addresses (or fail for none given as an error). */
const resolving = (found: Array<LookupAddress> | Error) => {
    const spy = jest.spyOn(dns, "lookup")
    // The overloaded signature of lookup is narrowed to the `all` form the policy uses.
    spy.mockImplementation((): never => {
        if (found instanceof Error) return Promise.reject(found) as never
        return Promise.resolve(found) as never
    })
    return spy
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe("public-endpoint.policy", () => {
    it("admits an http(s) address whose host resolves to public addresses only", async () => {
        const subject = await build()
        resolving(answers("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"))

        await expect(subject.isPublicEndpoint("https://mcp.shop.vn/mcp")).resolves.toBe(true)
        await expect(subject.isPublicEndpoint("http://93.184.216.34:8080/mcp")).resolves.toBe(true)
    })

    it.each([
        ["loopback", "http://127.0.0.1:3001/mcp"],
        ["private", "http://10.0.0.5/mcp"],
        ["metadata", "http://169.254.169.254/latest/meta-data"],
        ["ipv6 loopback", "http://[::1]/mcp"],
        ["ipv6 mapped private", "http://[::ffff:192.168.1.5]/mcp"],
    ])("refuses a %s literal without resolving anything", async (_label, url) => {
        const subject = await build()
        const lookup = resolving(answers("93.184.216.34"))

        await expect(subject.isPublicEndpoint(url)).resolves.toBe(false)
        expect(lookup).not.toHaveBeenCalled()
    })

    it("refuses a name when any of its answers is inside, and a name that does not resolve", async () => {
        const subject = await build()
        resolving(answers("93.184.216.34", "10.1.2.3"))
        await expect(subject.isPublicEndpoint("https://rebind.shop.vn/mcp")).resolves.toBe(false)

        resolving(new Error("ENOTFOUND"))
        await expect(subject.isPublicEndpoint("https://nowhere.shop.vn/mcp")).resolves.toBe(false)

        resolving([])
        await expect(subject.isPublicEndpoint("https://empty.shop.vn/mcp")).resolves.toBe(false)
    })

    it("refuses what is no http(s) URL", async () => {
        const subject = await build()

        await expect(subject.isPublicEndpoint("ftp://x.test")).resolves.toBe(false)
        await expect(subject.isPublicEndpoint("not a url")).resolves.toBe(false)
    })
})
