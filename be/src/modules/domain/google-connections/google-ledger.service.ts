import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderRegistryError, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { BusinessLedgerEntry, LedgerPort } from "@modules/domain/provider-registry"
import { GoogleError, InjectGoogleClient } from "@modules/integrations/google"
import type { GoogleClient, SheetCell } from "@modules/integrations/google"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
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

const PROVIDER = "google"

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
    ) {}

    /** True when a Google connection of the workspace gave the spreadsheets access and holds the ledger sheet. */
    async ready(workspaceId: string): Promise<boolean> {
        return (await this.keeperOf(workspaceId)) !== undefined
    }

    /** Appends the row of one entry. */
    append(workspaceId: string, entry: BusinessLedgerEntry): Promise<string | undefined> {
        return this.write(workspaceId, ledgerRowOf(entry))
    }

    /** Appends the row that takes one transaction back. */
    void(workspaceId: string, transactionId: string): Promise<string | undefined> {
        return this.write(workspaceId, voidRowOf(transactionId, dayOf(this.clock.now())))
    }

    private async write(workspaceId: string, line: ReadonlyArray<SheetCell>): Promise<string | undefined> {
        const keeper = await this.keeperOf(workspaceId)
        if (keeper === undefined) return undefined
        if (!this.google.isConfigured()) throw refusedLedger()
        const { row, sheetId } = keeper
        // A sheet headed by an older version (the first tab, seven columns) is laid out again: the cash book tab and its header are written
        // once, and what was written before stays where it is.
        const headed = row.meta.ledgerHeader === HEADER_WRITTEN && row.meta.ledgerLayout === LEDGER_LAYOUT
        const rows = headed ? [line] : [LEDGER_HEADER, line]
        try {
            const range = await this.appended(row, sheetId, rows, !headed)
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
            throw cause
        }
    }

    private appended(
        row: ConnectionRecord,
        sheetId: string,
        rows: ReadonlyArray<ReadonlyArray<SheetCell>>,
        newTab: boolean,
    ): Promise<string> {
        return this.tokens.withRetry(
            (force) => this.tokens.accessToken({ row, force }),
            async (token) => {
                if (newTab) await this.google.ensureTab(token, sheetId, LEDGER_TAB)
                return this.google.appendValues(token, sheetId, LEDGER_TAB, rows)
            },
            isUnauthorized,
        )
    }

    private async keeperOf(workspaceId: string): Promise<ReturnType<typeof ledgerKeeperOf>> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        return ledgerKeeperOf(rows)
    }
}
