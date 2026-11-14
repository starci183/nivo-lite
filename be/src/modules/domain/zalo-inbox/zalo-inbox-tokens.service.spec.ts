import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChannelsError, ChannelsErrorCode, ZaloCredentialsService } from "@modules/domain/channels"
import { refused } from "@modules/platform/primitives"
import { ZaloInboxTokensService } from "./zalo-inbox-tokens.service"

const build = async () => {
    const credentials = mock<ZaloCredentialsService>()
    credentials.load.mockResolvedValue({
        kind: "ok",
        value: { secret: { appId: "a", appSecret: "s", oaSecret: "o", accessToken: "t" }, expiresAt: null, workspaceId: "ws-1" },
    })
    credentials.accessToken.mockResolvedValue("token")
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloInboxTokensService, { provide: ZaloCredentialsService, useValue: credentials }],
    }).compile()
    return { tokens: moduleRef.get(ZaloInboxTokensService), credentials }
}

describe("ZaloInboxTokensService tokenOf", () => {
    it("answers the connection's access token, refreshed by the credential keeper when due", async () => {
        const { tokens, credentials } = await build()

        await expect(tokens.tokenOf("c-1")).resolves.toEqual({ kind: "token", token: "token" })
        expect(credentials.accessToken).toHaveBeenCalledWith("c-1")
    })

    it("skips a connection whose credential is unusable or holds no access token yet, without asking for one", async () => {
        const { tokens, credentials } = await build()
        credentials.load.mockResolvedValueOnce(refused(ChannelsErrorCode.ConnectionNotFound))
        await expect(tokens.tokenOf("c-1")).resolves.toEqual({ kind: "skipped", reason: "not_ready" })

        credentials.load.mockResolvedValueOnce({
            kind: "ok",
            value: { secret: { appId: "a", appSecret: "s", oaSecret: "o" }, expiresAt: null, workspaceId: "ws-1" },
        })
        await expect(tokens.tokenOf("c-1")).resolves.toEqual({ kind: "skipped", reason: "no_token" })
        expect(credentials.accessToken).not.toHaveBeenCalled()
    })
})

describe("ZaloInboxTokensService failureOf", () => {
    it.each([
        ["a connection that was never authorised", new ChannelsError({ code: ChannelsErrorCode.ZaloNotAuthorized }), { kind: "auth_failed", reason: "credential" }],
        ["an unreadable credential", new ChannelsError({ code: ChannelsErrorCode.SecretUnreadable }), { kind: "auth_failed", reason: "credential" }],
        ["a token refresh in progress", new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy }), { kind: "transient" }],
        ["a missing connection", new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound }), { kind: "fatal" }],
        ["an error that is not the credential keeper's", new Error("boom"), null],
    ])("maps %s", async (_name, error, expected) => {
        const { tokens } = await build()

        expect(tokens.failureOf(error)).toEqual(expected)
    })
})
