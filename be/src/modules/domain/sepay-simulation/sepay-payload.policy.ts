import type { SimulatedAccount, SimulatedSepayBody, SimulationRequest } from "./sepay-simulation.contracts"

const VIETNAM_OFFSET_MS = 7 * 3_600_000

/** The transaction stamp SePay prints: `YYYY-MM-DD HH:mm:ss` in Vietnam time. */
export const stampOf = (instant: Date): string =>
    new Date(instant.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ")

/** The body of the simulated delivery for a request at an instant. */
export const payloadOf = (request: SimulationRequest, account: SimulatedAccount, now: Date): SimulatedSepayBody => {
    const content = `${request.orderCode} chuyen tien`
    return {
        id: request.transactionId ?? now.getTime(),
        gateway: account.bankCode,
        transactionDate: stampOf(now),
        accountNumber: account.bankAccount,
        subAccount: null,
        code: null,
        content,
        transferType: request.debit ? "out" : "in",
        description: `BankAPINotify ${content}`,
        transferAmount: request.amount,
        referenceCode: `FT${now.getTime()}`,
        accumulated: 0,
    }
}
