import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/**
 * The bounded arguments of the payment-link tools (`nivo.tool.payment.link.*`).
 *
 * `returnUrl` and `cancelUrl` are REQUIRED because payOS's create reference marks both required and signs them (https://payos.vn/docs/api/).
 * The description bound is NOT a provider limit: the reference states "gioi han ky tu la 9" only for bank accounts not linked through payOS
 * and no general maximum, so this ceiling only keeps the request small and payOS's own refusal decides the rest. The amount is a positive
 * whole number of dong (the reference: an integer); no ceiling is stated, so none is invented (the safe-integer bound only keeps it exact).
 */
export const LINK_DESCRIPTION_MAX = 255

/** The longest link address or reference the tools take (ours, not a provider's). */
const URL_MAX = 2048
const REFERENCE_MAX = 200
const LINK_ID_MAX = 100
const REASON_MAX = 255

const amountVnd = z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .describe("The amount to pay, in VND (a positive whole number).")

export const LINK_CREATE_SCHEMA: z.ZodType<{ amountVnd: number; description: string; returnUrl: string; cancelUrl: string; reference?: string | undefined; expiresAt?: string | undefined; }> = z
    .object({
        amountVnd,
        description: z
            .string()
            .trim()
            .min(1)
            .max(LINK_DESCRIPTION_MAX)
            .describe("The payment's description the provider shows and carries as the transfer content; the provider may allow far fewer characters (payOS: 9 for a bank account not linked through payOS)."),
        reference: z
            .string()
            .min(1)
            .max(REFERENCE_MAX)
            .optional()
            .describe("Your own reference (for example an order code). Returned untouched in the answer; it is NOT sent to the provider and is never the provider's order code."),
        returnUrl: z.url().max(URL_MAX).describe("Where the payer's browser goes after paying (the provider requires it)."),
        cancelUrl: z.url().max(URL_MAX).describe("Where the payer's browser goes after cancelling (the provider requires it)."),
        expiresAt: z.iso
            .datetime({ offset: true })
            .max(64)
            .optional()
            .describe("When the link stops being valid, ISO 8601 with an offset; absent keeps the provider's own default."),
    })
    .strict()

/** The two ways to name a link, each optional. */
interface LinkRefMembers {
    /** The provider id of the link. */
    readonly linkId?: string | undefined
    /** The order code of the link. */
    readonly orderCode?: number | undefined
}

/** Exactly one of the two ways the provider documents to name a link: its id or its order code. */
const oneOfTheTwo = (value: LinkRefMembers): boolean =>
    (value.linkId === undefined) !== (value.orderCode === undefined)

const REF_MEMBERS = {
    linkId: z.string().min(1).max(LINK_ID_MAX).optional().describe("The provider's id of the link, as the create answered it."),
    orderCode: z
        .number()
        .int()
        .positive()
        .max(Number.MAX_SAFE_INTEGER)
        .optional()
        .describe("The provider's order code of the link, as the create answered it."),
}

export const LINK_GET_SCHEMA: z.ZodType<{ linkId?: string | undefined; orderCode?: number | undefined; }> = z.object(REF_MEMBERS).strict().refine(oneOfTheTwo, { message: "name the link by linkId or orderCode, exactly one" })

export const LINK_CANCEL_SCHEMA: z.ZodType<{ reason?: string | undefined; linkId?: string | undefined; orderCode?: number | undefined; }> = z
    .object({ ...REF_MEMBERS, reason: z.string().min(1).max(REASON_MAX).optional().describe("Why the link is cancelled (optional).") })
    .strict()
    .refine(oneOfTheTwo, { message: "name the link by linkId or orderCode, exactly one" })

/** The schemas the manifest announces, generated from the validators. */
export const LINK_CREATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(LINK_CREATE_SCHEMA, { io: "input" })
export const LINK_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(LINK_GET_SCHEMA, { io: "input" })
export const LINK_CANCEL_INPUT_SCHEMA: ToolJson = z.toJSONSchema(LINK_CANCEL_SCHEMA, { io: "input" })
