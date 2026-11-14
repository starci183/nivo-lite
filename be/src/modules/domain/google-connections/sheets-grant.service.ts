import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import {
    InjectGoogleClient,
    SHEETS_PURPOSE,
    SHEETS_SCOPE,
    sheetUrlOf,
    type GoogleClient,
} from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import type { ConsentStart, LedgerGrant } from "./google-connections.contracts"
import { GoogleTokensService } from "./google-tokens.service"
import {
    consentRowOf,
    consentedMeta,
    grantRowOf,
    grantsSheets,
    ledgerConnectionOf,
    SHEETS_GRANTED,
    spreadsheetIdOf,
} from "./policies/ledger-sheet.policy"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const

/** Where a held grant stands: lost when its connection failed, granted until a sheet is named, ready after. */
const ledgerStateOf = (lost: boolean, sheetId: string): LedgerGrant["state"] => {
    if (lost) return "lost"
    return sheetId === "" ? "granted" : "ready"
}

const NONE: LedgerGrant = { state: "none", email: "", sheetId: "", sheetUrl: "", sheetTitle: "", lastRowAt: "" }

@Injectable()
/**
 * The ledger grant of a workspace: the spreadsheets access added to a Google connection by a second consent (the scopes already granted
 * are kept), and the one sheet the owner chose for the ledger. Both live in the public facts of the connection: `sheets: granted` and
 * `ledgerSheet: <spreadsheet id>`. The consent reuses the Google callback with purpose `sheets_ledger` in the signed state.
 */
export class SheetsGrantService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        private readonly tokens: GoogleTokensService,
    ) {}

    /** Starts the spreadsheets consent (owner): the Google url the browser must go to. */
    async authorize(actor: ConnectionActor, returnTo: string): Promise<ConsentStart> {
        await this.connections.authorize(actor, OWNER)
        return this.tokens.consent({ actor, returnTo, scope: SHEETS_SCOPE, purpose: SHEETS_PURPOSE })
    }

    /** Where the ledger of the workspace stands (owner or manager): no access, access without a sheet, a working ledger or a lost one. */
    async grant(actor: ConnectionActor): Promise<LedgerGrant> {
        await this.connections.authorize(actor, MANAGER)
        const rows = await this.rowsOf(actor.workspaceId)
        const row = ledgerConnectionOf(rows) ?? rows.find((held) => held.meta.sheets === SHEETS_GRANTED)
        if (row === undefined) return NONE
        const sheetId = row.meta.ledgerSheet ?? ""
        return {
            state: ledgerStateOf(row.status === "error", sheetId),
            email: row.meta.email ?? "",
            sheetId,
            sheetUrl: sheetId === "" ? "" : sheetUrlOf(sheetId),
            sheetTitle: row.meta.ledgerSheetTitle ?? "",
            lastRowAt: row.meta.ledgerLastRowAt ?? "",
        }
    }

    /**
     * Names the spreadsheet the ledger is written to (owner), from its link or its id. The workspace must have given the spreadsheets
     * access first. The sheet is where the owner wants the copy; NIVO adds rows to its first tab and never reads or changes what is there.
     */
    async setLedgerSheet(actor: ConnectionActor, sheet: string): Promise<LedgerGrant> {
        await this.connections.authorize(actor, OWNER)
        const sheetId = spreadsheetIdOf(sheet)
        if (sheetId === "") throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.SheetInvalid })
        const row = grantRowOf(await this.rowsOf(actor.workspaceId))
        if (row === undefined) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })
        if (row.meta.ledgerSheet !== sheetId) {
            // A new sheet has no header row yet, so the mark of the old one goes.
            const kept = Object.fromEntries(
                Object.entries(row.meta).filter(([key]) => key !== "ledgerHeader" && key !== "ledgerSheetTitle"),
            )
            const { title } = await this.titleOf(row, sheetId)
            await this.connections.patch(actor.workspaceId, row.id, {
                meta: { ...kept, ledgerSheet: sheetId, ...(title === "" ? {} : { ledgerSheetTitle: title }) },
            })
        }
        return this.grant(actor)
    }

    /**
     * Stores the grant a consent code gives on the connection of the Google account that consented (a new connection when it is a new
     * account). Throws GOOGLE_CONNECTIONS_SHEETS_SCOPE_MISSING when the owner unticked the spreadsheets access and
     * GOOGLE_CONNECTIONS_MISSING when Google sent no refresh token and none was kept from before.
     */
    async complete(workspaceId: string, userId: string, code: string): Promise<void> {
        const tokens = await this.google.exchangeCode(code)
        if (!grantsSheets(tokens.scope)) {
            throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.SheetsScopeMissing })
        }
        const email = await this.google.accountEmail(tokens)
        const row = consentRowOf(await this.rowsOf(workspaceId), email)
        const refresh = await this.tokens.keptRefresh(row, tokens.renewalToken)
        if (!refresh) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })
        const account = email ?? row?.meta.email ?? ""
        await this.tokens.save({
            workspaceId,
            userId,
            row,
            provider: "google",
            name: account === "" ? "Google" : `Google - ${account}`,
            meta: { ...consentedMeta(row?.meta, account), sheets: SHEETS_GRANTED },
            tokens: { access_token: tokens.accessToken, renewal_token: refresh, expires_at: tokens.expiresAt },
        })
    }

    /**
     * The title Google gives the sheet, asked with the grant own token. When it cannot be read the title is blank and the outcome
     * carries why: the owner can still use the sheet.
     */
    private async titleOf(
        row: ConnectionRecord,
        sheetId: string,
    ): Promise<{ readonly title: string; readonly cause?: unknown }> {
        try {
            const token = await this.tokens.accessToken({ row, force: false })
            return { title: (await this.google.spreadsheetTitle(token, sheetId)) || "" }
        } catch (cause) {
            return { title: "", cause }
        }
    }

    private rowsOf(workspaceId: string): Promise<ReadonlyArray<ConnectionRecord>> {
        return this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
    }
}
