/**
 * The provider refused the connection itself (the permission was withdrawn, the scope was never given, the destination is not shared with
 * the account): only the owner can cure it, so it is never tried again.
 */
export class LedgerConnectionRefusedError extends Error {
    constructor(readonly provider: string) {
        super(`LEDGER_CONNECTION_REFUSED: ${provider}`)
        this.name = "LedgerConnectionRefusedError"
    }
}
