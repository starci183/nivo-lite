import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/** The longest draft or renewal reference the tool takes (ours: the CRM's own ids, never a provider's). */
const REFERENCE_MAX = 200

/**
 * The arguments of `nivo.tool.invoice.create` (the e-invoice issue purpose, `InvoiceIssuePort`): the invoice draft the issue is of (the
 * CRM keeps it: storage only) and the renewal it ties to, if any. Exactly the port's request: the e-invoice provider's own members are added
 * to the PORT once its documentation is read (MISA meInvoice's is not readable: `MISA_MEINVOICE_OPERATIONS`).
 */
export const INVOICE_CREATE_SCHEMA: z.ZodType<{ draftId: string; renewalId?: string | null | undefined }> = z
    .object({
        draftId: z.string().trim().min(1).max(REFERENCE_MAX).describe("The invoice draft to issue, by the id the draft was stored under."),
        renewalId: z
            .string()
            .trim()
            .min(1)
            .max(REFERENCE_MAX)
            .nullable()
            .optional()
            .describe("The renewal the invoice is for, by its id; absent or null for none."),
    })
    .strict()

/** The JSON Schema the model and the door read. */
export const INVOICE_CREATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(INVOICE_CREATE_SCHEMA, { io: "input" })
