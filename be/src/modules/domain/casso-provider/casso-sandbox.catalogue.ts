import type {
    SandboxCase,
    SandboxCatalogue,
    SandboxInboundCase,
    SandboxInboundContext,
    SandboxInput,
    SandboxInputField,
    SandboxWebhookEvent,
} from "@modules/domain/provider-sandbox"

/** The provider key of the Casso catalogue. */
export const CASSO_SANDBOX_PROVIDER = "casso"

/** The receiving bank account every sandbox Casso account owns (fixed, the same on every machine). */
export const CASSO_SANDBOX_ACCOUNT = {
    accountNumber: "0011004455667",
    bankName: "Vietcombank",
    bankAbbreviation: "VCB",
} as const

/** The FIXED deviation of the short and the over payment (owner, R62): 1,000 VND, the same as SePay's. */
export const CASSO_SANDBOX_DEVIATION_VND = 1000

/** The first transaction id of a sandbox account; each send takes the next (`+ seq`), so ids are deterministic per account. */
export const CASSO_SANDBOX_FIRST_ID = 7100001

/** The balance of the receiving account before any movement (the `runningBalance` of Casso's body runs from it). */
export const CASSO_SANDBOX_OPENING_BALANCE = 5_000_000

/** The state name the transactions a case made are kept under (what Casso posted, in order). */
export const CASSO_SANDBOX_MOVEMENTS_STATE = "movements"

/** One transaction of Casso's webhook V2 (`data`), in Casso's own field names. Money out carries a NEGATIVE amount, as Casso sends it. */
export interface CassoSandboxTransaction {
    readonly id: number
    readonly reference: string
    readonly description: string
    readonly amount: number
    readonly runningBalance: number
    readonly transactionDateTime: string
    readonly accountNumber: string
    readonly bankName: string
    readonly bankAbbreviation: string
    readonly virtualAccountNumber: string
    readonly virtualAccountName: string
    readonly counterAccountName: string
    readonly counterAccountNumber: string
    readonly counterAccountBankId: string
    readonly counterAccountBankName: string
}

/** The body of Casso's webhook V2: `error` 0 and ONE transaction in `data`. */
export interface CassoSandboxBody {
    readonly error: 0
    readonly data: CassoSandboxTransaction
}

/** What the bank does in one case: the signed amount (negative = money out), the content, and how many times Casso posts it. */
interface CassoMovementPlan {
    readonly amount: number
    readonly content: string
    readonly deliveries: number
}

/** The two inputs of every Casso case (R62): bank words only, the transfer content and the amount the payer was asked for. */
const INPUTS: ReadonlyArray<SandboxInputField> = [
    { name: "content", label: "Nội dung chuyển khoản / Transfer content", kind: "text", example: "NIVO DH1001" },
    { name: "amount", label: "Số tiền (VND) / Amount (VND)", kind: "integer", example: 350_000 },
]

/** The inputs read back (the send checked their kinds against `INPUTS`). */
const readInput = (input: SandboxInput): { readonly content: string; readonly amount: number } => ({
    content: typeof input.content === "string" ? input.content : "",
    amount: typeof input.amount === "number" ? input.amount : 0,
})

/**
 * A reference that names nothing the payer was asked for (`CASSO-7`): the content with every digit turned to 0 (`NIVO DH1001` ->
 * `NIVO DH0000`), or, for a content with no digit, the content followed by ` 000000`. Same shape, names no request.
 */
export const unknownCassoReferenceOf = (content: string): string => (/\d/u.test(content) ? content.replace(/\d/gu, "0") : `${content} 000000`)

/** Casso's booking time text (Vietnam time, UTC+7, no zone) of an instant. */
export const cassoTimeOf = (at: Date): string => new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ")

/** The transactions a sandbox account's cases made, oldest first (empty for a new account). */
export const cassoMovementsOf = (kept: unknown): ReadonlyArray<CassoSandboxTransaction> =>
    Array.isArray(kept) ? kept.filter((one): one is CassoSandboxTransaction => typeof one === "object" && one !== null && "id" in one) : []

/** The running balance after the account's kept transactions. */
const balanceOf = (movements: ReadonlyArray<CassoSandboxTransaction>): number =>
    movements.reduce((sum, one) => sum + one.amount, CASSO_SANDBOX_OPENING_BALANCE)

/** The webhook route of a Casso feed on NIVO for one account. */
const cassoRoute = (connectionId: string): string => `api/connections/casso/${connectionId}`

/**
 * One Casso inbound case: the plan's movement becomes ONE transaction (id `7100001 + seq`, booked at the send's moment, the account's
 * running balance) in webhook V2's body `{ error: 0, data }`, kept in the account's state and posted `deliveries` times.
 */
const caseOf = (plan: (input: { readonly content: string; readonly amount: number }) => CassoMovementPlan): SandboxInboundCase => ({
    trigger: "transaction.received",
    path: cassoRoute,
    inputs: INPUTS,
    eventsOf: async (input: SandboxInput, context: SandboxInboundContext): Promise<ReadonlyArray<SandboxWebhookEvent>> => {
        const movement = plan(readInput(input))
        const kept = cassoMovementsOf(await context.state.read(CASSO_SANDBOX_MOVEMENTS_STATE, ""))
        const id = CASSO_SANDBOX_FIRST_ID + context.state.seq
        const data: CassoSandboxTransaction = {
            id,
            reference: `FT26${String(id)}`,
            description: movement.content,
            amount: movement.amount,
            runningBalance: balanceOf(kept) + movement.amount,
            transactionDateTime: cassoTimeOf(context.at),
            accountNumber: CASSO_SANDBOX_ACCOUNT.accountNumber,
            bankName: CASSO_SANDBOX_ACCOUNT.bankName,
            bankAbbreviation: CASSO_SANDBOX_ACCOUNT.bankAbbreviation,
            virtualAccountNumber: "",
            virtualAccountName: "",
            counterAccountName: "",
            counterAccountNumber: "",
            counterAccountBankId: "",
            counterAccountBankName: "",
        }
        const body: CassoSandboxBody = { error: 0, data }
        await context.state.write(CASSO_SANDBOX_MOVEMENTS_STATE, "", [...kept, data])
        return Array.from({ length: movement.deliveries }, () => ({ body }))
    },
})

/**
 * Casso's hardcoded sandbox cases (owner ruling R62): each a named TRANSFORMATION of `{ content, amount }` into the webhook V2 body
 * Casso posts on `api/connections/casso/<connectionId>`, with the SAME seven meanings as SePay's so the two feeds are interchangeable
 * in a test. The sandbox knows bank words only (content, amount), never an order. The deviation of a short or an over payment is a FIXED
 * 1,000 VND. Casso has no payment-instruction operation, so there is no prefill: the page's form starts from the examples.
 */
export const CASSO_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: CASSO_SANDBOX_PROVIDER,
    cases: [
        {
            id: "CASSO-1",
            label: "Paid in full: money in with the content and the exact amount",
            inbound: caseOf(({ content, amount }) => ({ amount, content, deliveries: 1 })),
        },
        {
            id: "CASSO-2",
            label: "Short by 1,000 VND: money in with the content, amount - 1,000",
            inbound: caseOf(({ content, amount }) => ({ amount: amount - CASSO_SANDBOX_DEVIATION_VND, content, deliveries: 1 })),
        },
        {
            id: "CASSO-3",
            label: "Over by 1,000 VND: money in with the content, amount + 1,000",
            inbound: caseOf(({ content, amount }) => ({ amount: amount + CASSO_SANDBOX_DEVIATION_VND, content, deliveries: 1 })),
        },
        {
            id: "CASSO-4",
            label: "No content: money in with the exact amount and an EMPTY transfer content",
            inbound: caseOf(({ amount }) => ({ amount, content: "", deliveries: 1 })),
        },
        {
            id: "CASSO-5",
            label: "Money OUT: a debit of the amount with the content (Casso sends it as a negative amount)",
            inbound: caseOf(({ content, amount }) => ({ amount: -amount, content, deliveries: 1 })),
        },
        {
            id: "CASSO-6",
            label: "Delivered twice: the SAME transaction (same id) posted two times, paid in full",
            inbound: caseOf(({ content, amount }) => ({ amount, content, deliveries: 2 })),
        },
        {
            id: "CASSO-7",
            label: "A reference naming nothing asked: the exact amount, the content's digits turned to 0",
            inbound: caseOf(({ content, amount }) => ({ amount, content: unknownCassoReferenceOf(content), deliveries: 1 })),
        },
    ] satisfies ReadonlyArray<SandboxCase>,
}
