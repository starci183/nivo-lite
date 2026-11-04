import { LedgerConnectionRefusedError } from "./ledger-connection-refused.error"

describe("LedgerConnectionRefusedError", () => {
    it("names the provider that refused the connection", () => {
        const error = new LedgerConnectionRefusedError("google")

        expect(error).toBeInstanceOf(Error)
        expect(error.provider).toBe("google")
        expect(error.message).toBe("LEDGER_CONNECTION_REFUSED: google")
        expect(error.name).toBe("LedgerConnectionRefusedError")
    })
})
