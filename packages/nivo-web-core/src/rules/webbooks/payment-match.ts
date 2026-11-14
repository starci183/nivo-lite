/**
 * The exact match of a bank credit against the requests that await money: a pure rule, no tool, no model. Only identifiers and numbers
 * are compared (a payment code held in the transfer text, an amount equal to a total); no word is read for meaning. What the rule leaves
 * open (a short or an over payment, two requests that fit) is not decided here: the step hands it to the agent and the company's truths.
 */

/** One credit as the bank account's raw row holds it: its id, its amount in whole VND and the transfer text the payer wrote. */
export interface CreditFacts {
    /** The id of the bank credit. */
    readonly id: string
    /** The amount of the credit in VND. */
    readonly amountVnd: number
    /** The reference text of the bank credit; null when none. */
    readonly reference: string | null
}

/** One request that awaits money, as the CRM holds it: its payment code and its total in whole VND, each possibly absent. */
export interface AwaitingFacts {
    /** The payment code the customer was told to pay with; null when none. */
    readonly paymentCode: string | null
    /** The total the order awaits in VND; null when none is known. */
    readonly totalVnd: number | null
}

/** What the rule found, exactly, for one request: whether the credit names its payment code, whether its amount is the total. */
export interface Exact {
    /** True when the credit's reference names the payment code. */
    readonly named: boolean
    /** True when the credit's amount equals the amount owed. */
    readonly amountMatches: boolean
}

/** A transfer text as the bank may write it, upper case with only letters and digits kept (`gh-8k2q` is `GH8K2Q`). */
const compactOf = (text: string | null): string =>
    (text ?? "")
        .normalize("NFKD")
        .toUpperCase()
        .replaceAll(/[^A-Z0-9]/g, "")

/** The exact facts of one request for the credit: its code named in the transfer text, its total equal to the amount. */
export const exactOf = (credit: CreditFacts, request: AwaitingFacts): Exact => {
    const code = compactOf(request.paymentCode)
    return {
        named: code !== "" && compactOf(credit.reference).includes(code),
        amountMatches: request.totalVnd !== null && request.totalVnd === credit.amountVnd,
    }
}

/** True when the exact facts say the credit pays the request: its code named AND its total equal. */
export const paysExactly = (exact: Exact): boolean => exact.named && exact.amountMatches

/**
 * The one request the credit pays exactly, among `requests` (each with its exact facts); null when none or more than one does, so the
 * credit is not clear.
 */
export const onlyExactOf = <T extends { readonly exact: Exact }>(requests: ReadonlyArray<T>): T | null => {
    const clear = requests.filter((one) => paysExactly(one.exact))
    const [only] = clear
    return clear.length === 1 && only !== undefined ? only : null
}
