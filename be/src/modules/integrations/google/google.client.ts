import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { GoogleLogEvent } from "./google.log-events"
import { GoogleError, GoogleErrorCode } from "./errors/google.error"
import { InjectGoogleOptions } from "./google.decorators"
import type { GoogleOptions } from "./google.options"
import { GOOGLE_SCOPE } from "./google.contracts"
import type {
    CreatedSpreadsheet,
    GoogleIdentityTokens,
    GoogleTokenSet,
    OAuthStateInput,
    OptionalAccountEmail,
    OptionalConsentUrl,
    OptionalOAuthState,
    ReceivedText,
    SheetCell,
    SheetConfig,
    SheetEventIn,
    SheetEventResult,
    SheetRowRef,
    SheetsApi,
} from "./google.contracts"
import { applySheetEvent, buildCreateBody, buildFormatBody, ordersTab } from "./google-sheet.policy"
import { signState, stateKey, verifyState } from "./google-state.policy"
import { buildAuthUrl, redirectUri, sheetUrlOf, sheetsBase, tokenEndpoint, userinfoEndpoint } from "./google-url.policy"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

const a1 = (tab: string, range: string): string => encodeURIComponent(`'${tab}'!${range}`)

const columnLetter = (width: number): string => String.fromCodePoint(64 + width)

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

    /** Exchanges a refresh token for a new access token. */
    refreshAccessToken(refreshToken: string): Promise<GoogleTokenSet> {
        const { client } = this.options
        if (client === null) throw new GoogleError({ code: GoogleErrorCode.NotConfigured })
        return this.tokens({
            refresh_token: refreshToken,
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
            return textOf(body.email) || null
        } catch (cause) {
            this.logger.error(GoogleLogEvent.EmailUnavailable, cause)
            return null
        }
    }

    /** Creates the orders spreadsheet (two tabs, header rows, a sample row) and formats the money column. */
    async createOrdersSpreadsheet(token: string, title: string): Promise<CreatedSpreadsheet> {
        const base = sheetsBase(this.options)
        const created = await this.call({
            method: "POST",
            url: `${base}/v4/spreadsheets`,
            headers: this.bearer(token),
            body: buildCreateBody(title, this.clock.now()),
        })
        const spreadsheetId = textOf(created.spreadsheetId)
        if (!spreadsheetId) throw new GoogleError({ code: GoogleErrorCode.ContractMismatch })
        await this.call({
            method: "POST",
            url: `${base}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
            headers: this.bearer(token),
            body: buildFormatBody(),
        })
        return { spreadsheetId, spreadsheetUrl: textOf(created.spreadsheetUrl) ?? sheetUrlOf(spreadsheetId) }
    }

    /** The sheet operations bound to one access token. */
    sheets(token: string): SheetsApi {
        return {
            findRow: (spreadsheetId, codes) => this.findRow(token, spreadsheetId, codes),
            appendRow: (spreadsheetId, tab, width, row) => this.appendRow(token, spreadsheetId, tab, width, row),
            updateCells: (spreadsheetId, row, cells) => this.updateCells(token, spreadsheetId, row, cells),
        }
    }

    /** Applies one NIVO event to the shop's sheet with an access token; throws on any API failure so the caller retries. */
    applyEvent(token: string, config: SheetConfig, event: SheetEventIn): Promise<SheetEventResult> {
        return applySheetEvent(this.sheets(token), config, event, this.clock.now())
    }

    private async findRow(
        token: string,
        spreadsheetId: string,
        codes: ReadonlyArray<string>,
    ): Promise<SheetRowRef | null> {
        const wanted = codes.map((code) => code.trim()).filter(Boolean)
        if (wanted.length === 0) return null
        const body = await this.call({
            method: "GET",
            url: `${sheetsBase(this.options)}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${a1(ordersTab(), "B:B")}`,
            headers: this.bearer(token),
        })
        const rows: ReadonlyArray<unknown> = Array.isArray(body.values) ? body.values : []
        const cells = rows.map((row) => (Array.isArray(row) ? String(row[0] ?? "").trim() : ""))
        for (const code of wanted) {
            const at = cells.findIndex((cell, index) => index > 0 && cell === code)
            if (at >= 0) return { row: at + 1, code }
        }
        return null
    }

    private async appendRow(
        token: string,
        spreadsheetId: string,
        tab: string,
        width: number,
        row: ReadonlyArray<SheetCell>,
    ): Promise<number> {
        const range = a1(tab, `A:${columnLetter(width)}`)
        const body = await this.call({
            method: "POST",
            url: `${sheetsBase(this.options)}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
            headers: this.bearer(token),
            body: { majorDimension: "ROWS", values: [row] },
        })
        const updates = isJson(body.updates) ? body.updates : {}
        const matched = /!?[A-Z]+(\d+)(?::[A-Z]+\d+)?$/u.exec(textOf(updates.updatedRange) ?? "")
        return matched?.[1] ? Number(matched[1]) : 0
    }

    private async updateCells(
        token: string,
        spreadsheetId: string,
        row: number,
        cells: Readonly<Record<string, SheetCell>>,
    ): Promise<void> {
        const data = Object.entries(cells).map(([column, value]) => ({
            range: `'${ordersTab()}'!${column}${row}`,
            majorDimension: "ROWS",
            values: [[value]],
        }))
        await this.call({
            method: "POST",
            url: `${sheetsBase(this.options)}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
            headers: this.bearer(token),
            body: { valueInputOption: "RAW", data },
        })
    }

    private emailOfIdToken(idToken: string | null): string | null {
        if (idToken === null) return null
        const read = parseJsonText(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"))
        return read.ok && isJson(read.value) ? textOf(read.value.email) || null : null
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
            refreshToken: textOf(body.refresh_token) ?? null,
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
