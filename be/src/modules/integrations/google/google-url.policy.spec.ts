import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import {
    authEndpoint,
    buildAuthUrl,
    isConsentFailure,
    redirectUri,
    sheetUrlOf,
    sheetsBase,
    tokenEndpoint,
    userinfoEndpoint,
} from "./google-url.policy"

const SUBJECT = Symbol("google-url.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    authEndpoint,
                    buildAuthUrl,
                    isConsentFailure,
                    redirectUri,
                    sheetUrlOf,
                    sheetsBase,
                    tokenEndpoint,
                    userinfoEndpoint,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./google-url.policy")>(SUBJECT)
}

const CLIENT = { clientId: "client-1", clientSecret: new Secret("secret-1") }

describe("endpoints", () => {
    it("point at Google by default", async () => {
        const subject = await build()

        expect(subject.authEndpoint({ oauthBase: undefined })).toBe("https://accounts.google.com/o/oauth2/v2/auth")
        expect(subject.tokenEndpoint({ oauthBase: undefined })).toBe("https://oauth2.googleapis.com/token")
        expect(subject.userinfoEndpoint({ oauthBase: undefined })).toBe(
            "https://openidconnect.googleapis.com/v1/userinfo",
        )
        expect(subject.sheetsBase({ sheetsBase: undefined })).toBe("https://sheets.googleapis.com")
    })

    it("follow a local fake base without trailing slashes", async () => {
        const subject = await build()

        expect(subject.authEndpoint({ oauthBase: "http://fake.test/" })).toBe("http://fake.test/o/oauth2/v2/auth")
        expect(subject.tokenEndpoint({ oauthBase: "http://fake.test//" })).toBe("http://fake.test/token")
        expect(subject.userinfoEndpoint({ oauthBase: "http://fake.test" })).toBe("http://fake.test/userinfo")
        expect(subject.sheetsBase({ sheetsBase: "http://sheets.test/" })).toBe("http://sheets.test")
    })
})

describe("redirectUri", () => {
    it("is the byte-identical callback path, or null without a site url", async () => {
        const subject = await build()

        expect(subject.redirectUri({ siteUrl: "https://nivo.vn/" })).toBe(
            "https://nivo.vn/api/connections/google/callback",
        )
        expect(subject.redirectUri({ siteUrl: undefined })).toBeNull()
    })
})

describe("buildAuthUrl", () => {
    it("builds the consent url with the state and the account picker", async () => {
        const subject = await build()

        const url = new URL(
            subject.buildAuthUrl({ client: CLIENT, oauthBase: undefined, siteUrl: "https://nivo.vn" }, "state-1") ?? "",
        )

        expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth")
        expect(url.searchParams.get("client_id")).toBe("client-1")
        expect(url.searchParams.get("redirect_uri")).toBe("https://nivo.vn/api/connections/google/callback")
        expect(url.searchParams.get("scope")).toContain("drive.file")
        expect(url.searchParams.get("prompt")).toBe("select_account consent")
        expect(url.searchParams.get("state")).toBe("state-1")
    })

    it("takes another scope and is null when the client or the site url is missing", async () => {
        const subject = await build()

        const base = { client: CLIENT, oauthBase: undefined, siteUrl: "https://nivo.vn" }

        expect(new URL(subject.buildAuthUrl(base, "s", "drive.readonly") ?? "").searchParams.get("scope")).toBe(
            "drive.readonly",
        )
        expect(subject.buildAuthUrl({ ...base, client: null }, "s")).toBeNull()
        expect(subject.buildAuthUrl({ ...base, siteUrl: undefined }, "s")).toBeNull()
    })
})

describe("isConsentFailure", () => {
    it("recognises the refusals that mean the app is not usable for this person", async () => {
        const subject = await build()

        expect(subject.isConsentFailure("access_denied")).toBe(true)
        expect(subject.isConsentFailure("invalid_client")).toBe(true)
        expect(subject.isConsentFailure("invalid_grant")).toBe(false)
    })
})

describe("sheetUrlOf", () => {
    it("opens the spreadsheet", async () => {
        const subject = await build()

        expect(subject.sheetUrlOf("abc")).toBe("https://docs.google.com/spreadsheets/d/abc/edit")
    })
})
