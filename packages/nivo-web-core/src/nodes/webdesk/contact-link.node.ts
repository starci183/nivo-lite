import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { crmAnswered, refused } from "../web-answers"
import { ID_MAX } from "./desk-shapes"
import { webdeskText } from "../../modules/webdesk/copy"

/**
 * The customer identified, and the sender's address their record does not hold yet; either may read nothing (the identify step answers
 * null when it found nobody or nothing to link), and then there is nothing to link.
 */
export interface ContactLinkInput {
    /** The customer to link it to; null when none. */
    readonly customerCode?: string | null | undefined
    /** The address to link; null when none. */
    readonly address?: string | null | undefined
}

/** Whether the address is now on the customer's record, and the CRM's refusal when it is not. */
export interface ContactLinkOutput {
    /** True when the address was linked to the customer. */
    readonly linked: boolean
    /** Why the provider refused the call; null when it did not refuse. */
    readonly refusal: string | null
}

type NoParams = Record<string, never>

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<ContactLinkInput> = z.object({
    customerCode: z.string().min(1).max(ID_MAX).nullish(),
    address: z.string().min(1).max(400).nullish(),
})
const output: z.ZodType<ContactLinkOutput> = z.object({ linked: z.boolean(), refusal: z.string().max(200).nullable() })

/** The contact update of the worked examples, as the CRM's document takes it (`LinkContactRequest`, the code in the path). */
const LINK_ARGS = { code: "KH-0001", channel: "email", address: "khach@example.com" }

/** What the CRM answers a link (`ContactLinkResponse`). */
const LINKED = {
    customerCode: "KH-0001",
    created: true,
    contact: {
        name: "Cong ty Example",
        preferredChannel: "email",
        phone: null,
        email: "khach@example.com",
        zaloId: null,
    },
}

/**
 * `webdesk.contact-link` (Link the sender to the customer): a side step split from `webdesk.intake`. One call of the CRM's
 * contact update that adds the mail address the identify step found the customer WITHOUT to the customer's record, so the next
 * mail from it is known at once. No AI call. A side step (`blocking: false`): without a CRM account it is skipped, and a refusal
 * is said in its output, never a stop of the ticket (the ticket is the graph's purpose). The update runs by itself (the node declares `auto`).
 */
export const webdeskContactLinkNode: TemplateNode<
    z.ZodType<ContactLinkInput>,
    z.ZodType<ContactLinkOutput>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webdesk.contact-link",
    title: webdeskText("node.contact-link.title"),
    description: { vi: "Li\u00ean k\u1ebft \u0111\u1ecba ch\u1ec9 th\u01b0 c\u1ee7a ng\u01b0\u1eddi g\u1eedi v\u1edbi kh\u00e1ch trong CRM.", en: "Links the sender's mail address to the customer in the CRM." },
    tools: [CRM_NIVOWEB.post_customers_code_contacts],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    blocking: false,
    sensitive: { address: "pii" },
    run: async (given, context) => {
        // Nothing to link: no customer identified, or the address is already how they were found (exact checks).
        if (given.customerCode === null || given.customerCode === undefined) return { linked: false, refusal: null }
        if (given.address === null || given.address === undefined) return { linked: false, refusal: null }
        const linked = await context.tools.call(CRM_NIVOWEB.post_customers_code_contacts, {
            code: given.customerCode,
            channel: "email",
            address: given.address,
        })
        // Any refusal, a person's `declined` included, is said in the output: the ticket is the graph's purpose, not the link.
        return linked.ok ? { linked: true, refusal: null } : { linked: false, refusal: linked.declined === true ? "declined" : linked.refusal }
    },
    examples: [
        {
            name: "adds the sender's address to the customer found by another fact",
            params: {},
            input: { customerCode: "KH-0001", address: "khach@example.com" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_customers_code_contacts,
                    args: LINK_ARGS,
                    answer: crmAnswered(LINKED),
                },
            ],
            output: { linked: true, refusal: null },
        },
        {
            name: "a refused link is said in the output; the ticket goes on",
            params: {},
            input: { customerCode: "KH-0001", address: "khach@example.com" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_customers_code_contacts,
                    args: LINK_ARGS,
                    answer: refused("contact_held_by_other_customer", { code: "KH-0007" }),
                },
            ],
            output: { linked: false, refusal: "contact_held_by_other_customer" },
        },
        {
            name: "a person declines the link: said in the output, the ticket goes on",
            params: {},
            input: { customerCode: "KH-0001", address: "khach@example.com" },
            tools: [{ id: CRM_NIVOWEB.post_customers_code_contacts, args: LINK_ARGS, answer: refused("declined") }],
            output: { linked: false, refusal: "declined" },
        },
        {
            name: "no address to link (or no customer): nothing is called",
            params: {},
            input: { customerCode: "KH-0001", address: null },
            output: { linked: false, refusal: null },
        },
    ],
})
