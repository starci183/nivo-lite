import { Injectable } from "@nestjs/common"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    ProviderRegistryError,
    ProviderRegistryErrorCode,
    withProof,
    type BusinessLedgerEntry,
    type LedgerPort,
} from "@modules/domain/provider-registry"
import { GoogleError, InjectGoogleClient, type GoogleClient, type SheetCell } from "@modules/integrations/google"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { GoogleTokensService } from "./google-tokens.service"
import {
    dayOf,
    HEADER_WRITTEN,
    isRefusedLedger,
    LEDGER_HEADER,
    LEDGER_LAYOUT,
    LEDGER_TAB,
    ledgerKeeperOf,
    ledgerRowOf,
    voidRowOf,
} from "./policies/ledger-sheet.policy"
import { DomainError } from "@modules/platform/errors"

const PROVIDER = "google"

/** Whether the append itself was asked of Google: the row may have reached it only after. */
interface AppendAsked {
    append: boolean
}

/** The refusal of a ledger connection only the owner can cure, carrying what Google answered, when it answered. */
const refusedLedger = (cause?: unknown): ProviderRegistryError =>
    new ProviderRegistryError({
        code: ProviderRegistryErrorCode.LedgerConnectionRefused,
        params: { provider: PROVIDER },
        ...(cause === undefined ? {} : { cause }),
    })

const isUnauthorized = (error: unknown): boolean => error instanceof GoogleError && error.params.status === 401

@Injectable()
/**
 * The business ledger of a workspace as a Google spreadsheet it chose: a copy that only grows. Every entry is one appended row on the
 * cash book tab (the tab and its header row first, once; a sheet laid out by an older version gets the tab on its next write); a void is one more row naming the transaction; no cell is changed, removed or read back. The
 * database stays the truth. The workspace is ready when one of its Google connections gave the spreadsheets access and was told the
 * sheet. A sheet Google refuses, a withdrawn access or a lost grant is the refused ledger connection: only the owner can cure it.
 * Any other failure (timeout, 429, 5xx) is thrown as it is and the run tries again.
 */
export class GoogleLedgerService implements LedgerPort {
    /** The provider this port writes the ledger through. */
    readonly provider: string = PROVIDER

    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        private readonly tokens: GoogleTokensService,
        @InjectClock() private readonly clock: Clock,
        private readonly zones: WorkspaceTimeZoneService,
    ) {}

    /** True when a Google connection of the workspace gave the spreadsheets access and holds the ledger sheet. */
    async ready(workspaceId: string): Promise<boolean> {
        return (await this.keeperOf(workspaceId)) !== undefined
    }

    /** Appends the row of one entry, on the connection the tool runner handed the call when it handed one. */
    append(workspaceId: string, entry: BusinessLedgerEntry, connectionId?: string): Promise<string | undefined> {
        return this.write(workspaceId, ledgerRowOf(entry), connectionId)
    }

    /** Appends the row that takes one transaction back, on the connection the tool runner handed the call when it handed one. */
    async void(workspaceId: string, transactionId: string, connectionId?: string): Promise<string | undefined> {
        const day = dayOf(this.clock.now(), await this.zones.timeZoneOf(workspaceId))
        return this.write(workspaceId, voidRowOf(transactionId, day), connectionId)
    }

    private async write(
        workspaceId: string,
        line: ReadonlyArray<SheetCell>,
        connectionId?: string,
    ): Promise<string | undefined> {
        const keeper = await this.keeperOf(workspaceId, connectionId)
        if (keeper === undefined) return undefined
        if (!this.google.isConfigured()) throw refusedLedger()
        const { row, sheetId } = keeper
        // A sheet headed by an older version (the first tab, seven columns) is laid out again: the cash book tab and its header are written
        // once, and what was written before stays where it is.
        const headed = row.meta.ledgerHeader === HEADER_WRITTEN && row.meta.ledgerLayout === LEDGER_LAYOUT
        const rows = headed ? [line] : [LEDGER_HEADER, line]
        // Whether the row may have reached Google: only once the append itself was asked (the token and the tab come first).
        const asked = { append: false }
        try {
            const range = await this.appended(row, sheetId, rows, !headed, asked)
            await this.connections.patch(workspaceId, row.id, {
                meta: {
                    ...row.meta,
                    ...(headed ? {} : { ledgerHeader: HEADER_WRITTEN, ledgerLayout: LEDGER_LAYOUT }),
                    ledgerLastRowAt: this.clock.now().toISOString(),
                },
            })
            return range === "" ? sheetId : range
        } catch (cause) {
            if (isRefusedLedger(cause)) throw refusedLedger(cause)
            // Thrown as it is (the run tries a rate limit, a 5xx or a timeout again), with what it proves where it happened: before the
            // append was asked the row never left; after, it may be there.
            const failure = withProof(cause, asked.append ? "unknown" : "not_sent")
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    private appended(
        row: ConnectionRecord,
        sheetId: string,
        rows: ReadonlyArray<ReadonlyArray<SheetCell>>,
        newTab: boolean,
        asked: AppendAsked,
    ): Promise<string> {
        return this.tokens.withRetry(
            (force) => this.tokens.accessToken({ row, force }),
            async (token) => {
                if (newTab) await this.google.ensureTab(token, sheetId, LEDGER_TAB)
                asked.append = true
                return this.google.appendValues(token, sheetId, LEDGER_TAB, rows)
            },
            isUnauthorized,
        )
    }

    /** The connection that keeps the ledger: the one named, when the call names one, else the first that keeps it. */
    private async keeperOf(workspaceId: string, connectionId?: string): Promise<ReturnType<typeof ledgerKeeperOf>> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        return ledgerKeeperOf(connectionId === undefined ? rows : rows.filter((row) => row.id === connectionId))
    }
}
