import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"
import { InjectZaloOptions } from "./zalo.decorators"
import type { ZaloTokens } from "./zalo.contracts"
import type { ZaloOptions } from "./zalo.options"
import { challengeOf } from "./zalo-oauth.policy"

/** Lifetime from the Zalo docs when the answer gives none: the access token lives 1 hour. */
const ACCESS_FALLBACK_SECONDS = 3600

const TOKEN_PATH = "/v4/oa/access_token"

@Injectable()
/** The one place that talks to Zalo. Nothing here reads the database or logs a secret. */
export class ZaloClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectZaloOptions() private readonly options: ZaloOptions,
    ) {}

    /** The URL the owner opens to grant the OA permissions (PKCE: the challenge is the S256 of the verifier). */
    authorizeUrl(appId: string, redirectUri: string, verifier: string, state: string): string {
        const query = new URLSearchParams({
            app_id: appId,
            redirect_uri: redirectUri,
            code_challenge: challengeOf(verifier),
            state,
        })
        return `${this.options.oauthBase}/v4/oa/permission?${query.toString()}`
    }

    /** Exchanges the authorization code for the first tokens of the OA. */
    exchangeCode(appId: string, appSecret: string, code: string, verifier: string): Promise<ZaloTokens> {
        return this.tokenCall(appSecret, {
            code,
            app_id: appId,
            grant_type: "authorization_code",
            code_verifier: verifier,
        })
    }

    /** Spends the single-use refresh token for a new pair. */
    refreshTokens(appId: string, appSecret: string, refreshToken: string): Promise<ZaloTokens> {
        return this.tokenCall(appSecret, { refresh_token: refreshToken, app_id: appId, grant_type: "refresh_token" })
    }

    /** Sends a consultation (CS) text message to one user and answers the message id Zalo gave, when it gave one. */
    async sendCsText(accessToken: string, userId: string, text: string): Promise<string | null> {
        const data = await this.apiCall(accessToken, "POST", "/v3.0/oa/message/cs", {
            recipient: { user_id: userId },
            message: { text },
        })
        return typeof data.message_id === "string" ? data.message_id : null
    }

    /** The customer's display name, or null when Zalo will not say: the name only labels the conversation. */
    async userDisplayName(accessToken: string, userId: string): Promise<string | null> {
        const data = await this.apiCall(
            accessToken,
            "GET",
            `/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`,
        ).catch((): Record<string, unknown> => ({}))
        const name = data.display_name ?? data.user_alias
        return typeof name === "string" && name.trim() ? name.trim() : null
    }

    private async tokenCall(secret: string, form: Record<string, string>): Promise<ZaloTokens> {
        const answer = await this.http
            .request({
                method: "POST",
                url: `${this.options.oauthBase}${TOKEN_PATH}`,
                headers: { secret_key: secret },
                form,
                timeoutMs: this.options.timeoutMs,
            })
            .catch((cause: unknown) => {
                throw new ZaloError({ code: ZaloErrorCode.Unavailable, cause })
            })
        const body = isRecord(answer.body) ? answer.body : {}
        const accessToken = body.access_token
        const refreshToken = body.refresh_token
        if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !accessToken || !refreshToken) {
            const code = Number(body.error)
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: {
                    path: TOKEN_PATH,
                    reason: this.reasonOf(body, answer.status),
                    ...(Number.isFinite(code) ? { zaloCode: code } : {}),
                },
            })
        }
        const seconds = Number(body.expires_in)
        return {
            accessToken,
            refreshToken,
            expiresInSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : ACCESS_FALLBACK_SECONDS,
        }
    }

    private async apiCall(
        accessToken: string,
        method: "GET" | "POST",
        path: string,
        body?: unknown,
    ): Promise<Record<string, unknown>> {
        const answer = await this.http
            .request({
                method,
                url: `${this.options.apiBase}${path}`,
                headers: { access_token: accessToken },
                ...(body === undefined ? {} : { body }),
                timeoutMs: this.options.timeoutMs,
            })
            .catch((cause: unknown) => {
                throw new ZaloError({ code: ZaloErrorCode.Unavailable, cause })
            })
        if (!isRecord(answer.body)) {
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { path, reason: `HTTP ${answer.status}` },
            })
        }
        const failure = answer.body.error
        if (typeof failure === "number" && failure !== 0) {
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { path, reason: this.reasonOf(answer.body, answer.status), zaloCode: failure },
            })
        }
        return isRecord(answer.body.data) ? answer.body.data : {}
    }

    private reasonOf(body: Record<string, unknown>, status: number): string {
        const text = [body.error_description, body.error_reason, body.error_name, body.message].find(
            (value): value is string => typeof value === "string" && value !== "",
        )
        return text ?? String(status)
    }
}
