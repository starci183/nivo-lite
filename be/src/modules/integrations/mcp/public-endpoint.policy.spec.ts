import { Test } from "@nestjs/testing"
import { failingLookup, resolvingTo } from "@tests/world/dns-lookup.world"
import { isPublicEndpoint, publicAddressOf } from "./public-endpoint.policy"

/** The members of the subject under test. */
interface Subject {
    readonly isPublicEndpoint: typeof isPublicEndpoint
    readonly publicAddressOf: typeof publicAddressOf
}

const SUBJECT = Symbol("public-endpoint.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isPublicEndpoint, publicAddressOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe("public-endpoint.policy", () => {
    it("answers the first public address a host resolves to, to pin the connection to", async () => {
        const subject = await build()
        resolvingTo("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946")

        await expect(subject.publicAddressOf("https://mcp.shop.vn/mcp")).resolves.toEqual({
            address: "93.184.216.34",
            family: 4,
        })
        await expect(subject.isPublicEndpoint("https://mcp.shop.vn/mcp")).resolves.toBe(true)
    })

    it("answers an IPv6 first answer as family 6, and a public literal as itself without resolving", async () => {
        const subject = await build()
        const lookup = resolvingTo("2606:2800:220:1:248:1893:25c8:1946")

        await expect(subject.publicAddressOf("https://v6.shop.vn/mcp")).resolves.toMatchObject({ family: 6 })
        lookup.mockClear()
        await expect(subject.publicAddressOf("http://93.184.216.34:8080/mcp")).resolves.toEqual({
            address: "93.184.216.34",
            family: 4,
        })
        await expect(subject.publicAddressOf("http://[2606:2800:220:1:248:1893:25c8:1946]/mcp")).resolves.toMatchObject(
            {
                family: 6,
            },
        )
        expect(lookup).not.toHaveBeenCalled()
    })

    it.each([
        ["loopback", "http://127.0.0.1:3001/mcp"],
        ["private", "http://10.0.0.5/mcp"],
        ["metadata", "http://169.254.169.254/latest/meta-data"],
        ["ipv6 loopback", "http://[::1]/mcp"],
        ["ipv6 mapped private", "http://[::ffff:192.168.1.5]/mcp"],
    ])("refuses a %s literal without resolving anything", async (_label, url) => {
        const subject = await build()
        const lookup = resolvingTo("93.184.216.34")

        await expect(subject.isPublicEndpoint(url)).resolves.toBe(false)
        expect(lookup).not.toHaveBeenCalled()
    })

    it("refuses a name when any of its answers is inside, and a name that does not resolve", async () => {
        const subject = await build()
        resolvingTo("93.184.216.34", "10.1.2.3")
        await expect(subject.isPublicEndpoint("https://rebind.shop.vn/mcp")).resolves.toBe(false)

        failingLookup()
        await expect(subject.isPublicEndpoint("https://nowhere.shop.vn/mcp")).resolves.toBe(false)

        resolvingTo()
        await expect(subject.isPublicEndpoint("https://empty.shop.vn/mcp")).resolves.toBe(false)
    })

    it("refuses what is no http(s) URL", async () => {
        const subject = await build()

        await expect(subject.isPublicEndpoint("ftp://x.test")).resolves.toBe(false)
        await expect(subject.isPublicEndpoint("not a url")).resolves.toBe(false)
    })
})
