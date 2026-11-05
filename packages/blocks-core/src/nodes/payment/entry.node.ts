import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { boundedJson, boundedRecord } from "../../json.schema"
import { bilingualOf } from "../../messages/catalog"
import { CLAIM_DINH, TRANSACTION_DINH } from "./payment.fixtures"

/** What woke Accounting: the subject of the trigger (a `{ kind, id }`, a label, or nothing) and the plain data the tagger handed over. */
interface EntryInput {
    readonly subject: unknown
    readonly context: Readonly<Record<string, unknown>> | null
}

/** Which way the run goes, and the one thing to gather evidence for. Exactly one of the two ids is set unless the branch is `none`. */
interface EntryOutput {
    readonly branch: "transaction" | "claim" | "none"
    readonly transactionId: string | null
    readonly claimId: string | null
}

/** The subject kind of a bank credit the feed tags Accounting with. */
const TRANSACTION_SUBJECT = "bank-transaction"

/** The node takes no settings. */
type NoParams = Record<string, never>

const params: z.ZodType<NoParams> = z.object({})
const input: z.ZodType<EntryInput, EntryInput> = z.object({
    subject: boundedJson,
    context: boundedRecord.nullable(),
})
const output: z.ZodType<EntryOutput, EntryOutput> = z.object({
    branch: z.enum(["transaction", "claim", "none"]),
    transactionId: z.string().max(MAX_ID).nullable(),
    claimId: z.string().max(MAX_ID).nullable(),
})

const transactionSubject = z.object({ kind: z.literal(TRANSACTION_SUBJECT), id: z.string().min(1).max(MAX_ID) })

const subjectIdOf = (subject: unknown): string | null => {
    const parsed = transactionSubject.safeParse(subject)
    return parsed.success ? parsed.data.id : null
}

const claimIdOf = (context: EntryInput["context"]): string | null => {
    const claimId = context?.claimId
    return typeof claimId === "string" && claimId !== "" ? claimId : null
}

/**
 * `payment.entry`: a pure condition at the start of the Accounting graph. A bank credit the feed tagged (the subject is a
 * `bank-transaction`) goes the `transaction` way; a payment claim the Chatbot tagged (its `claimId` in the context) goes the `claim` way;
 * anything else (a tag about another record, or a malformed one) is `none` and ends the run. The credit wins when both are given, so the
 * evidence always gets exactly one thing to look for.
 */
export const paymentEntryNode: NodeDefinition<
    z.ZodType<EntryInput, EntryInput>,
    z.ZodType<EntryOutput, EntryOutput>,
    z.ZodType<NoParams>
> = defineNode({
    id: "payment.entry",
    role: "condition",
    title: bilingualOf("nodePaymentEntryTitle"),
    params,
    input,
    output,
    rights: [],
    effects: [],
    run: (given) => {
        const transactionId = subjectIdOf(given.subject)
        if (transactionId !== null) return Promise.resolve({ branch: "transaction", transactionId, claimId: null })
        const claimId = claimIdOf(given.context)
        return Promise.resolve(
            claimId === null
                ? { branch: "none", transactionId: null, claimId: null }
                : { branch: "claim", transactionId: null, claimId },
        )
    },
    examples: [
        {
            name: "SePay 95958515 tagged by the bank feed: the transaction way",
            params: {},
            input: { subject: { kind: "bank-transaction", id: TRANSACTION_DINH.id }, context: null },
            output: { branch: "transaction", transactionId: TRANSACTION_DINH.id, claimId: null },
            effects: [],
        },
        {
            name: "a claim tagged by the Chatbot, with no subject: the claim way",
            params: {},
            input: { subject: null, context: { claimKind: "payment-claim.record", claimId: CLAIM_DINH.id } },
            output: { branch: "claim", transactionId: null, claimId: CLAIM_DINH.id },
            effects: [],
        },
        {
            name: "a credit wins over a claim in the same tag",
            params: {},
            input: {
                subject: { kind: "bank-transaction", id: TRANSACTION_DINH.id },
                context: { claimId: CLAIM_DINH.id },
            },
            output: { branch: "transaction", transactionId: TRANSACTION_DINH.id, claimId: null },
            effects: [],
        },
        {
            name: "a tag about another record, with an empty claim id, ends the run",
            params: {},
            input: { subject: { kind: "order", id: "order-dinh" }, context: { claimId: "" } },
            output: { branch: "none", transactionId: null, claimId: null },
            effects: [],
        },
        {
            name: "a tag with a bare label and no context ends the run",
            params: {},
            input: { subject: "bank-transaction", context: null },
            output: { branch: "none", transactionId: null, claimId: null },
            effects: [],
        },
    ],
})
