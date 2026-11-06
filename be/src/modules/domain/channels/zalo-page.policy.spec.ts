import { Test } from "@nestjs/testing"
import { checksOf, maskTail, recipientsOf, sendBlockOf, tokenViewOf } from "./zalo-page.policy"
import type { ZaloSecret } from "./channels.contracts"

const SUBJECT = Symbol("zalo-page.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { checksOf, maskTail, recipientsOf, sendBlockOf, tokenViewOf } }],
    }).compile()
    return moduleRef.get<typeof import("./zalo-page.policy")>(SUBJECT)
}

const NOW = Date.parse("2026-10-28T10:00:00.000Z")
const HOUR = 3_600_000

const secret = (patch: Partial<ZaloSecret> = {}): ZaloSecret => ({
    appId: "123456",
    appSecret: "app-secret-1234",
    oaSecret: "oa-key-9876",
    accessToken: "access",
    renewalToken: "refresh",
    refreshExpiresAt: "2027-01-01T00:00:00.000Z",
    ...patch,
})

describe("maskTail", () => {
    it("shows only dots and the last four characters", async () => {
        const subject = await build()
        expect(subject.maskTail("app-secret-1234")).toBe("\u2022\u2022\u2022\u20221234")
        expect(subject.maskTail("abc")).toBe("\u2022\u2022\u2022\u2022")
        expect(subject.maskTail("")).toBeNull()
    })
})

describe("tokenViewOf", () => {
    it("calls an unexpired access token valid", async () => {
        const subject = await build()
        const view = subject.tokenViewOf(secret(), NOW + HOUR, "connected", NOW)
        expect(view.state).toBe("valid")
        expect(view.expiredMinutesAgo).toBeNull()
    })

    it("calls an ended access token with a live refresh token renewable", async () => {
        const subject = await build()
        expect(subject.tokenViewOf(secret(), NOW - HOUR, "connected", NOW).state).toBe("renewable")
    })

    it("calls an ended token that cannot renew expired and says how long ago", async () => {
        const subject = await build()
        const view = subject.tokenViewOf(secret(), NOW - 3 * HOUR, "error", NOW)
        expect(view.state).toBe("expired")
        expect(view.expiredMinutesAgo).toBe(180)
        const noRefresh = subject.tokenViewOf(secret({ renewalToken: undefined }), NOW - HOUR, "connected", NOW)
        expect(noRefresh.state).toBe("expired")
    })

    it("calls a connection that was never authorized none", async () => {
        const subject = await build()
        const bare = secret({ accessToken: undefined, renewalToken: undefined })
        expect(subject.tokenViewOf(bare, null, "pending", NOW).state).toBe("none")
    })
})

describe("sendBlockOf", () => {
    it("names why the send is closed, in order of what the owner can fix", async () => {
        const subject = await build()
        const view = (state: "none" | "valid" | "renewable" | "expired") => ({
            state,
            expiresAt: null,
            expiredMinutesAgo: null,
            canRefresh: false,
        })
        expect(subject.sendBlockOf(view("none"), 3)).toBe("not_authorized")
        expect(subject.sendBlockOf(view("expired"), 3)).toBe("token_expired")
        expect(subject.sendBlockOf(view("valid"), 0)).toBe("no_recipient")
        expect(subject.sendBlockOf(view("renewable"), 1)).toBeNull()
    })
})

describe("checksOf", () => {
    const token = { state: "valid", expiresAt: null, expiredMinutesAgo: null, canRefresh: true } as const

    it("judges the webhook from the inbox", async () => {
        const subject = await build()
        const rows = subject.checksOf({
            appSaved: true,
            oaSecretSaved: true,
            token,
            inbox: { last_at: "2026-10-28T09:00:00.000Z", has_text: true, has_follow: false },
        })
        expect(rows.map((row) => [row.key, row.state, row.code])).toEqual([
            ["app", "ok", "app_saved"],
            ["token", "ok", "token_valid"],
            ["webhook", "ok", "webhook_receiving"],
        ])
        expect(rows[2]?.names).toEqual(["user_send_text"])
    })

    it("refuses to call the webhook fine without an OA secret key and says nothing arrived yet", async () => {
        const subject = await build()
        const base = { appSaved: false, token, inbox: null }
        expect(subject.checksOf({ ...base, oaSecretSaved: false })[2]?.code).toBe("webhook_no_secret")
        expect(subject.checksOf({ ...base, oaSecretSaved: true })[2]?.code).toBe("webhook_silent")
        expect(subject.checksOf({ ...base, oaSecretSaved: true })[0]?.code).toBe("app_missing")
    })
})

describe("recipientsOf", () => {
    it("keeps one row per Zalo user, strips the archive suffix and sorts newest first", async () => {
        const subject = await build()
        const rows = subject.recipientsOf([
            { conversationId: "c1", externalId: "u1:1700000000", name: "An", lastAt: "2026-10-28T08:00:00.000Z" },
            { conversationId: "c2", externalId: "u2", name: "", lastAt: "2026-10-28T09:00:00.000Z" },
            { conversationId: "c3", externalId: "u1", name: "An", lastAt: "2026-10-28T07:00:00.000Z" },
            { conversationId: "c4", externalId: ":1700", name: "x", lastAt: "2026-10-28T09:30:00.000Z" },
        ])
        expect(rows.map((row) => row.userId)).toEqual(["u2", "u1"])
        expect(rows[1]).toEqual({ userId: "u1", name: "An", lastMessageAt: "2026-10-28T08:00:00.000Z" })
    })
})

describe("edge cases of the token", () => {
    it("reads a refresh token without an end, with an unreadable end, or empty", async () => {
        const subject = await build()
        const open: ZaloSecret = { appId: "1", appSecret: "s", oaSecret: "o", renewalToken: "refresh" }
        expect(subject.tokenViewOf(open, NOW - HOUR, "connected", NOW).canRefresh).toBe(true)
        const unreadable = secret({ refreshExpiresAt: "not a date" })
        expect(subject.tokenViewOf(unreadable, NOW - HOUR, "connected", NOW).canRefresh).toBe(true)
        const ended = secret({ refreshExpiresAt: "2020-01-01T00:00:00.000Z" })
        expect(subject.tokenViewOf(ended, NOW - HOUR, "connected", NOW).canRefresh).toBe(false)
        const empty = secret({ renewalToken: "" })
        expect(subject.tokenViewOf(empty, NOW - HOUR, "connected", NOW).canRefresh).toBe(false)
    })

    it("keeps an ended token with no recorded end as expired without a count of minutes", async () => {
        const subject = await build()
        const view = subject.tokenViewOf(secret({ renewalToken: undefined }), null, "connected", NOW)
        expect(view).toMatchObject({ state: "expired", expiresAt: null, expiredMinutesAgo: null })
    })
})

describe("edge cases of the checks", () => {
    const base = { state: "valid", expiresAt: null, expiredMinutesAgo: null, canRefresh: true } as const

    it("words a webhook that has a row but no arrival time", async () => {
        const subject = await build()
        const rows = subject.checksOf({
            appSaved: true,
            oaSecretSaved: true,
            token: base,
            inbox: { last_at: null, has_text: false, has_follow: true },
        })
        expect(rows[2]).toMatchObject({ code: "webhook_silent", names: ["follow"] })
    })

    it("judges a renewable token as fine and a missing one as failing", async () => {
        const subject = await build()
        const checks = (state: "renewable" | "none") =>
            subject.checksOf({ appSaved: true, oaSecretSaved: true, token: { ...base, state }, inbox: null })[1]
        expect(checks("renewable")?.code).toBe("token_renewable")
        expect(checks("none")?.code).toBe("token_none")
    })
})
