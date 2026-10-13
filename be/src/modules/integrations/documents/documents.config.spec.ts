import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseDocumentsConfig } from "./documents.config"

const DOCUMENTS_CONFIG = Symbol("DOCUMENTS_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: DOCUMENTS_CONFIG, useFactory: parseDocumentsConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(DOCUMENTS_CONFIG)
}

describe("parseDocumentsConfig", () => {
    it("uses Google's Drive address and no client when nothing is declared", async () => {
        const options = await read({})

        expect(options.driveBase).toBe("https://www.googleapis.com/drive/v3")
        expect(options.oauthBase).toBeNull()
        expect(options.google).toBeNull()
        expect(options.readers.docx).toEqual(expect.any(Function))
        expect(options.readers.pdf).toEqual(expect.any(Function))
    })

    it("keeps a declared https base, drops a trailing slash, and ignores a base that is not http", async () => {
        await expect(
            read({ GOOGLE_DRIVE_BASE: "https://drive.example/v3/", GOOGLE_OAUTH_BASE: "https://oauth.example/" }),
        ).resolves.toMatchObject({
            driveBase: "https://drive.example/v3",
            oauthBase: "https://oauth.example",
        })
        await expect(
            read({ GOOGLE_DRIVE_BASE: "ftp://drive.example", GOOGLE_OAUTH_BASE: "not a url" }),
        ).resolves.toMatchObject({
            driveBase: "https://www.googleapis.com/drive/v3",
            oauthBase: null,
        })
    })

    it("reads the Google client from the first id and secret that are both declared", async () => {
        await expect(
            read({ GOOGLE_OAUTH_CLIENT_ID: "client-1", GOOGLE_OAUTH_CLIENT_SECRET: "secret-1" }),
        ).resolves.toMatchObject({
            google: { clientId: "client-1", clientSecret: new Secret("secret-1") },
        })
        await expect(
            read({
                SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: "client-2",
                SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: "secret-2",
            }),
        ).resolves.toMatchObject({
            google: { clientId: "client-2", clientSecret: new Secret("secret-2") },
        })
        await expect(read({ GOOGLE_OAUTH_CLIENT_ID: "client-1" })).resolves.toMatchObject({ google: null })
        await expect(read({ GOOGLE_OAUTH_CLIENT_SECRET: "secret-1" })).resolves.toMatchObject({ google: null })
        await expect(
            read({
                GOOGLE_OAUTH_CLIENT_ID: "client-1",
                SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: "secret-2",
            }),
        ).resolves.toMatchObject({
            google: { clientId: "client-1", clientSecret: new Secret("secret-2") },
        })
    })
})
