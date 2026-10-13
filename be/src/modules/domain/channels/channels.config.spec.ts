import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseChannelsConfig } from "./channels.config"
import { CHANNELS_OPTIONS } from "./channels.decorators"
import type { ChannelsOptions } from "./channels.options"

const compile = async (values: Readonly<Record<string, string | undefined>>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            {
                provide: CHANNELS_OPTIONS,
                useFactory: (env: EnvSource) => parseChannelsConfig(env),
                inject: [EnvSource],
            },
        ],
    }).compile()
    return moduleRef
}

describe("parseChannelsConfig", () => {
    it("reads the site origin and drops one trailing slash", async () => {
        const moduleRef = await compile({ SITE_URL: "https://app.example.com/" })

        expect(moduleRef.get<ChannelsOptions>(CHANNELS_OPTIONS)).toEqual({ siteUrl: "https://app.example.com" })
        await moduleRef.close()
    })

    it("keeps a site origin that has no trailing slash", async () => {
        const moduleRef = await compile({ SITE_URL: "https://app.example.com" })

        expect(moduleRef.get<ChannelsOptions>(CHANNELS_OPTIONS)).toEqual({ siteUrl: "https://app.example.com" })
        await moduleRef.close()
    })

    it("drops only the last slash when the origin ends with two", async () => {
        const moduleRef = await compile({ SITE_URL: "https://app.example.com//" })

        expect(moduleRef.get<ChannelsOptions>(CHANNELS_OPTIONS)).toEqual({ siteUrl: "https://app.example.com/" })
        await moduleRef.close()
    })

    it("leaves the site origin null when it is not declared", async () => {
        const moduleRef = await compile({})

        expect(moduleRef.get<ChannelsOptions>(CHANNELS_OPTIONS)).toEqual({ siteUrl: null })
        await moduleRef.close()
    })

    it("leaves the site origin null when the variable is empty", async () => {
        const moduleRef = await compile({ SITE_URL: "" })

        expect(moduleRef.get<ChannelsOptions>(CHANNELS_OPTIONS)).toEqual({ siteUrl: null })
        await moduleRef.close()
    })
})
