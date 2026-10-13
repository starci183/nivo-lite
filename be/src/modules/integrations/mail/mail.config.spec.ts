import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseMailConfig } from "./mail.config"

const MAIL_CONFIG = Symbol("MAIL_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: MAIL_CONFIG, useFactory: parseMailConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(MAIL_CONFIG)
}

describe("parseMailConfig", () => {
    it.each([
        ["a missing site", {}],
        ["an unparsable site", { SITE_URL: "not a url" }],
        ["a plain-http site", { SITE_URL: "http://shop.example" }],
        ["localhost", { SITE_URL: "https://localhost" }],
        ["a loopback address", { SITE_URL: "https://127.0.0.1" }],
        ["an IPv6 loopback", { SITE_URL: "https://[::1]" }],
        ["a localhost subdomain", { SITE_URL: "https://app.localhost" }],
    ])("allows private hosts on %s", async (_site, values) => {
        await expect(read(values)).resolves.toEqual({
            allowPrivateHosts: true,
            platform: null,
            helloName: "nivo.vn",
        })
    })

    it("keeps private hosts off a public site unless the flag says otherwise", async () => {
        await expect(read({ SITE_URL: "https://nivo.vn" })).resolves.toEqual({
            allowPrivateHosts: false,
            platform: null,
            helloName: "nivo.vn",
        })
        await expect(read({ SITE_URL: "https://nivo.vn", SMTP_ALLOW_PRIVATE_HOSTS: "true" })).resolves.toMatchObject({
            allowPrivateHosts: true,
        })
    })

    it("reads the platform sender and the hello name when they are declared", async () => {
        await expect(
            read({
                SITE_URL: "https://nivo.vn",
                SMTP_URL: "smtp://mail.example",
                SMTP_FROM: "NIVO <hi@nivo.vn>",
                SMTP_HELLO_NAME: "mail.nivo.vn",
            }),
        ).resolves.toEqual({
            allowPrivateHosts: false,
            platform: { url: new Secret("smtp://mail.example"), from: "NIVO <hi@nivo.vn>" },
            helloName: "mail.nivo.vn",
        })
    })
})
