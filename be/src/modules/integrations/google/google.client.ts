import { Injectable } from "@nestjs/common"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectHttpClient, type HttpClient } from "@modules/platform/http"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { GoogleLogEvent } from "./google.log-events"
import { GoogleError, GoogleErrorCode } from "./errors/google.error"
import { InjectGoogleOptions } from "./google.decorators"
import type { GoogleOptions } from "./google.options"
import {
    GOOGLE_SCOPE,
    RENEWAL_GRANT_FIELD,
    type GoogleIdentityTokens,
    type GoogleTokenSet,
    type OAuthStateInput,
    type OptionalAccountEmail,
    type OptionalConsentUrl,
    type OptionalOAuthState,
    type ReceivedText,
    type SheetCell,
} from "./google.contracts"
import { signState, stateKey, verifyState } from "./google-state.policy"
import { buildAuthUrl, redirectUri, sheetsBase, tokenEndpoint, userinfoEndpoint } from "./google-url.policy"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

/** The email a userinfo answer names, or null when it names none (an empty text names none). */
const emailOf = (value: unknown): string | null => {
    const text = textOf(value)
    return text === undefined || text === "" ? null : text
}

const a1 = (tab: string, range: string): string => encodeURIComponent(`'${tab}'!${range}`)

/** The columns of the ledger tab: date, document, description, in, out, counterpart, category, balance. */
const LEDGER_COLUMNS = "A:H"

@Injectable()
/** Talks to Google OAuth and the Sheets API for the connections capability: consent urls, tokens, spreadsheets and rows. */
export class GoogleClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectGoogleOptions() private readonly options: GoogleOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when this deployment has an OAuth client and a site url to return to. */
    isConfigured(): boolean {
        return this.options.client !== null && redirectUri(this.options) !== null
    }

    /** The Google consent url for a signed state, or null when Google is not configured. */
    authUrl(state: string, scope: string = GOOGLE_SCOPE): OptionalConsentUrl {
        return buildAuthUrl(this.options, state, scope)
    }

    /** Signs a ten-minute OAuth state with the key derived from the channel token key. */
    sign(input: OAuthStateInput): string {
        return signState(stateKey(this.options.channelTokenKey.reveal()), input, this.clock.now().getTime())
    }

    /** The state of a callback when its signature is valid and it has not expired; otherwise null. */
    verify(value: ReceivedText): OptionalOAuthState {
        return verifyState(stateKey(this.options.channelTokenKey.reveal()), value, this.clock.now().getTime())
    }

    /** Exchanges a consent code for tokens. */
    exchangeCode(code: string): Promise<GoogleTokenSet> {
        const { client } = this.options
        const redirect = redirectUri(this.options)
        if (client === null || redirect === null) {
            throw new GoogleError({ code: GoogleErrorCode.NotConfigured })
        }
        return this.tokens({
            code,
            client_id: client.clientId,
            client_secret: client.clientSecret.reveal(),
            redirect_uri: redirect,
            grant_type: "authorization_code",
        })
    }

    /** Exchanges a provider renewal token for a new access token. */
    refreshAccessToken(renewalToken: string): Promise<GoogleTokenSet> {
        const { client } = this.options
        if (client === null) throw new GoogleError({ code: GoogleErrorCode.NotConfigured })
        return this.tokens({
            [RENEWAL_GRANT_FIELD]: renewalToken,
            client_id: client.clientId,
            client_secret: client.clientSecret.reveal(),
            grant_type: "refresh_token",
        })
    }

    /** The account email: from the id token payload (received directly from Google over TLS), else the userinfo endpoint; null when neither says. */
    async accountEmail(tokens: GoogleIdentityTokens): Promise<OptionalAccountEmail> {
        const fromToken = this.emailOfIdToken(tokens.idToken)
        if (fromToken !== null) return fromToken
        try {
            const body = await this.call({
                method: "GET",
                url: userinfoEndpoint(this.options),
                headers: { authorization: `Bearer ${tokens.accessToken}` },
            })
            return emailOf(body.email)
        } catch (cause) {
            this.logger.error(GoogleLogEvent.EmailUnavailable, cause)
            return null
        }
    }

    /**
     * Appends rows after the last one of a tab of a spreadsheet and answers the A1 range Google wrote them to. The values are entered as a
     * person would type them (a date becomes a date, a number a number, and a formula runs), so the caller makes every text cell text.
     * Never updates or removes a cell. Throws `GOOGLE_REFUSED` (with the HTTP status) when Google refuses.
     */
    async appendValues(
        token: string,
        spreadsheetId: string,
        tab: string,
        rows: ReadonlyArray<ReadonlyArray<SheetCell>>,
    ): Promise<string> {
        const body = await this.call({
            method: "POST",
            url: `${sheetsBase(this.options)}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${a1(tab, LEDGER_COLUMNS)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            headers: this.bearer(token),
            body: { majorDimension: "ROWS", values: rows },
        })
        const updates = isJson(body.updates) ? body.updates : {}
        return textOf(updates.updatedRange) ?? ""
    }

    /**
     * Makes sure a spreadsheet has a tab of this title, adding it (with a frozen header row) when it has none. Adds only; no cell or
     * tab already there is changed. Throws `GOOGLE_REFUSED` (with the HTTP status) when Google refuses.
     */
    async ensureTab(token: string, spreadsheetId: string, title: string): Promise<void> {
        const base = `${sheetsBase(this.options)}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`
        const body = await this.call({
            method: "GET",
            url: `${base}?fields=sheets.properties.title`,
            headers: this.bearer(token),
        })
        const sheets: ReadonlyArray<unknown> = Array.isArray(body.sheets) ? body.sheets : []
        const titles = sheets.map((sheet) => (isJson(sheet) && isJson(sheet.properties) ? textOf(sheet.properties.title) : undefined))
        if (titles.includes(title)) return
        await this.call({
            method: "POST",
            url: `${base}:batchUpdate`,
            headers: this.bearer(token),
            body: {
                requests: [
                    {
                        addSheet: {
                            properties: { title, gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: 8 } },
                        },
                    },
                ],
            },
        })
    }

    /** The title of a spreadsheet, blank when Google names none. Throws `GOOGLE_REFUSED` (with the HTTP status) when Google refuses. */
    async spreadsheetTitle(token: string, spreadsheetId: string): Promise<string> {
        const body = await this.call({
            method: "GET",
            url: `${sheetsBase(this.options)}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title`,
            headers: this.bearer(token),
        })
        const properties = isJson(body.properties) ? body.properties : {}
        return textOf(properties.title) ?? ""
    }

    /** The values of an A1 range of the first tab, as text rows (blank cells at the end of a row are not sent by Google). */
    async readValues(
        token: string,
        spreadsheetId: string,
        range: string,
    ): Promise<ReadonlyArray<ReadonlyArray<string>>> {
        const body = await this.call({
            method: "GET",
            url: `${sheetsBase(this.options)}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
            headers: this.bearer(token),
        })
        const rows: ReadonlyArray<unknown> = Array.isArray(body.values) ? body.values : []
        return rows.map((row) => (Array.isArray(row) ? row.map(String) : []))
    }

    private emailOfIdToken(idToken: string | null): string | null {
        if (idToken === null) return null
        const read = parseJsonText(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"))
        return read.ok && isJson(read.value) ? emailOf(read.value.email) : null
    }

    private bearer(token: string): Record<string, string> {
        return { authorization: `Bearer ${token}` }
    }

    private async tokens(form: Record<string, string>): Promise<GoogleTokenSet> {
        const body = await this.call({ method: "POST", url: tokenEndpoint(this.options), form })
        const accessToken = textOf(body.access_token)
        if (!accessToken) throw new GoogleError({ code: GoogleErrorCode.ContractMismatch })
        return {
            accessToken,
            renewalToken: textOf(body[RENEWAL_GRANT_FIELD]) ?? null,
            expiresAt:
                this.clock.now().getTime() + (typeof body.expires_in === "number" ? body.expires_in : 3600) * 1000,
            idToken: textOf(body.id_token) ?? null,
            scope: textOf(body.scope) ?? null,
        }
    }

    private async call(request: Omit<Parameters<HttpClient["request"]>[0], "timeoutMs">): Promise<Json> {
        const response = await this.send(request)
        const body = isJson(response.body) ? response.body : {}
        if (response.status >= 200 && response.status < 300) return body
        throw new GoogleError({
            code: GoogleErrorCode.Refused,
            params: { status: response.status, reason: this.reasonOf(body) },
        })
    }

    private async send(request: Omit<Parameters<HttpClient["request"]>[0], "timeoutMs">) {
        try {
            return await this.http.request({ ...request, timeoutMs: this.options.timeoutMs })
        } catch (cause) {
            throw new GoogleError({ code: GoogleErrorCode.Unreachable, cause })
        }
    }

    private reasonOf(body: Json): string {
        const { error } = body
        if (typeof error === "string") return error
        return isJson(error) && typeof error.status === "string" ? error.status : ""
    }
}
