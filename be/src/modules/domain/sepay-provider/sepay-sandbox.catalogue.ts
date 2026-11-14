import type {
    SandboxCase,
    SandboxCatalogue,
    SandboxInboundCase,
    SandboxInboundContext,
    SandboxInput,
    SandboxInputField,
    SandboxWebhookEvent,
} from "@modules/domain/provider-sandbox"

/** The provider key of the SePay catalogue. */
export const SEPAY_SANDBOX_PROVIDER = "sepay"

/** The receiving bank account every sandbox SePay account owns (fixed, the same on every machine). */
export const SEPAY_SANDBOX_ACCOUNT = {
    accountNumber: "0011004455667",
    bankCode: "VCB",
    bankName: "Vietcombank",
    accountHolder: "NIVO SANDBOX SHOP",
} as const

/** The FIXED deviation of the short and the over payment (owner, R62): 1,000 VND. */
export const SEPAY_SANDBOX_DEVIATION_VND = 1000

/** The first transaction id of a sandbox account; each send takes the next (`+ seq`), so ids are deterministic per account. */
export const SEPAY_SANDBOX_FIRST_ID = 9100001

/** The balance of the receiving account before any movement (the `accumulated` of SePay's body runs from it). */
export const SEPAY_SANDBOX_OPENING_BALANCE = 5_000_000

/** The state name the bank movements a case made are kept under (the poll and the list read them back, as SePay lists them). */
export const SEPAY_SANDBOX_MOVEMENTS_STATE = "movements"

/** The body of SePay's webhook for one money movement, in SePay's own field names (the shape its docs state). */
export interface SepaySandboxBody {
    readonly id: number
    readonly gateway: string
    readonly transactionDate: string
    readonly accountNumber: string
    readonly code: string | null
    readonly content: string
    readonly transferType: "in" | "out"
    readonly transferAmount: number
    readonly accumulated: number
    readonly subAccount: string | null
    readonly referenceCode: string
    readonly description: string
}

/** What the bank does in one case: the direction, the amount and the content of the movement, and how many times SePay posts it. */
interface SepayMovementPlan {
    readonly transferType: "in" | "out"
    readonly amount: number
    readonly content: string
    readonly deliveries: number
}

/** The two inputs of every SePay case (R62): bank words only, the transfer content and the amount the payer was asked for. */
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
 * A reference that names nothing the payer was asked for (`SEPAY-7`): the content with every digit turned to 0 (`NIVO DH1001` ->
 * `NIVO DH0000`), or, for a content with no digit, the content followed by ` 000000`. Same shape, names no request.
 */
export const unknownReferenceOf = (content: string): string => (/\d/u.test(content) ? content.replace(/\d/gu, "0") : `${content} 000000`)

/** SePay's booking time text (Vietnam time, UTC+7, no zone) of an instant. */
export const sepayTimeOf = (at: Date): string => new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ")

/** The movements a sandbox account's cases made, oldest first (empty for a new account). */
export const sepayMovementsOf = (kept: unknown): ReadonlyArray<SepaySandboxBody> =>
    Array.isArray(kept) ? kept.filter((one): one is SepaySandboxBody => typeof one === "object" && one !== null && "id" in one) : []

/** The running balance after the account's kept movements. */
const balanceOf = (movements: ReadonlyArray<SepaySandboxBody>): number =>
    movements.reduce((sum, one) => sum + (one.transferType === "in" ? one.transferAmount : -one.transferAmount), SEPAY_SANDBOX_OPENING_BALANCE)

/** The webhook route of a SePay workspace feed on NIVO for one account. */
const sepayRoute = (connectionId: string): string => `api/connections/sepay/${connectionId}`

/**
 * One SePay inbound case: the plan's movement becomes ONE bank transaction (id `9100001 + seq`, booked at the send's moment, the
 * account's running balance), kept in the account's state so the poll and the list read it back, and posted `deliveries` times.
 */
const caseOf = (plan: (input: { readonly content: string; readonly amount: number }) => SepayMovementPlan): SandboxInboundCase => ({
    trigger: "transaction.received",
    path: sepayRoute,
    inputs: INPUTS,
    eventsOf: async (input: SandboxInput, context: SandboxInboundContext): Promise<ReadonlyArray<SandboxWebhookEvent>> => {
        const movement = plan(readInput(input))
        const kept = sepayMovementsOf(await context.state.read(SEPAY_SANDBOX_MOVEMENTS_STATE, ""))
        const id = SEPAY_SANDBOX_FIRST_ID + context.state.seq
        const balance = balanceOf(kept) + (movement.transferType === "in" ? movement.amount : -movement.amount)
        const body: SepaySandboxBody = {
            id,
            gateway: SEPAY_SANDBOX_ACCOUNT.bankName,
            transactionDate: sepayTimeOf(context.at),
            accountNumber: SEPAY_SANDBOX_ACCOUNT.accountNumber,
            code: null,
            content: movement.content,
            transferType: movement.transferType,
            transferAmount: movement.amount,
            accumulated: balance,
            subAccount: null,
            referenceCode: `FT26${String(id)}`,
            description: movement.content === "" ? "" : `BankAPINotify ${movement.content}`,
        }
        await context.state.write(SEPAY_SANDBOX_MOVEMENTS_STATE, "", [...kept, body])
        return Array.from({ length: movement.deliveries }, () => ({ body }))
    },
})

/**
 * SePay's hardcoded sandbox cases (owner ruling R62): each a named TRANSFORMATION of `{ content, amount }` (prefilled from the account's
 * latest payment instruction) into the webhook body SePay posts on `api/connections/sepay/<connectionId>`. The sandbox knows bank words
 * only (content, amount), never an order. The deviation of a short or an over payment is a FIXED 1,000 VND.
 */
export const SEPAY_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: SEPAY_SANDBOX_PROVIDER,
    prefill: {
        operation: "transfer",
        inputOf: (request: unknown): SandboxInput | null => {
            if (typeof request !== "object" || request === null) return null
            const content: unknown = Reflect.get(request, "content")
            const amount: unknown = Reflect.get(request, "amountVnd")
            return typeof content === "string" && typeof amount === "number" ? { content, amount } : null
        },
    },
    cases: [
        {
            id: "SEPAY-1",
            label: "Paid in full: money in with the content and the exact amount",
            inbound: caseOf(({ content, amount }) => ({ transferType: "in", amount, content, deliveries: 1 })),
        },
        {
            id: "SEPAY-2",
            label: "Short by 1,000 VND: money in with the content, amount - 1,000",
            inbound: caseOf(({ content, amount }) => ({ transferType: "in", amount: amount - SEPAY_SANDBOX_DEVIATION_VND, content, deliveries: 1 })),
        },
        {
            id: "SEPAY-3",
            label: "Over by 1,000 VND: money in with the content, amount + 1,000",
            inbound: caseOf(({ content, amount }) => ({ transferType: "in", amount: amount + SEPAY_SANDBOX_DEVIATION_VND, content, deliveries: 1 })),
        },
        {
            id: "SEPAY-4",
            label: "No content: money in with the exact amount and an EMPTY transfer content",
            inbound: caseOf(({ amount }) => ({ transferType: "in", amount, content: "", deliveries: 1 })),
        },
        {
            id: "SEPAY-5",
            label: "Money OUT: a debit of the amount with the content",
            inbound: caseOf(({ content, amount }) => ({ transferType: "out", amount, content, deliveries: 1 })),
        },
        {
            id: "SEPAY-6",
            label: "Delivered twice: the SAME transaction (same id) posted two times, paid in full",
            inbound: caseOf(({ content, amount }) => ({ transferType: "in", amount, content, deliveries: 2 })),
        },
        {
            id: "SEPAY-7",
            label: "A reference naming nothing asked: the exact amount, the content's digits turned to 0",
            inbound: caseOf(({ content, amount }) => ({ transferType: "in", amount, content: unknownReferenceOf(content), deliveries: 1 })),
        },
    ] satisfies ReadonlyArray<SandboxCase>,
}
