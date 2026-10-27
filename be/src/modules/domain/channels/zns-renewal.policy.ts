import type {
    OptionalZnsRenewal,
    RenewalNoticeFields,
    ZnsRenewalParams,
    ZnsRenewalSettings,
} from "./channels.contracts"

/** The connection meta key of the template id. */
const TEMPLATE_KEY = "zns_renewal_template_id"

/** The connection meta key of each parameter name. */
const PARAM_KEYS: Readonly<Record<keyof ZnsRenewalParams, string>> = {
    customerName: "zns_renewal_param_customer_name",
    plan: "zns_renewal_param_plan",
    endDate: "zns_renewal_param_end_date",
    amount: "zns_renewal_param_amount",
    transferContent: "zns_renewal_param_transfer_content",
    invoiceNumber: "zns_renewal_param_invoice_number",
}

const FIELDS: ReadonlyArray<keyof ZnsRenewalParams> = [
    "customerName",
    "plan",
    "endDate",
    "amount",
    "transferContent",
    "invoiceNumber",
]

/** ZNS template ids are numbers. */
const TEMPLATE_ID = /^\d{1,20}$/u

/** A template parameter name as the ZNS console lets one be declared. */
const PARAM_NAME = /^[A-Za-z_]\w{0,49}$/u

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/u

/** The field of the settings that does not hold a valid value, or null when they all do. An empty template id clears the settings. */
export const invalidZnsField = (settings: ZnsRenewalSettings): string | null => {
    if (settings.templateId !== "" && !TEMPLATE_ID.test(settings.templateId)) return "templateId"
    const bad = FIELDS.find((field) => settings.params[field] !== "" && !PARAM_NAME.test(settings.params[field]))
    return bad === undefined ? null : bad
}

/** The ZNS renewal settings stored on a Zalo connection's meta, or null when no template is configured. */
export const znsRenewalOf = (meta: Readonly<Record<string, string>>): OptionalZnsRenewal => {
    const templateId = (meta[TEMPLATE_KEY] ?? "").trim()
    if (templateId === "") return null
    const param = (field: keyof ZnsRenewalParams): string => (meta[PARAM_KEYS[field]] ?? "").trim()
    return {
        templateId,
        params: {
            customerName: param("customerName"),
            plan: param("plan"),
            endDate: param("endDate"),
            amount: param("amount"),
            transferContent: param("transferContent"),
            invoiceNumber: param("invoiceNumber"),
        },
    }
}

/** The connection meta with the ZNS renewal settings written in; an empty template id or name removes its key. */
export const withZnsRenewal = (
    meta: Readonly<Record<string, string>>,
    settings: ZnsRenewalSettings,
): Record<string, string> => {
    const next: Record<string, string> = { ...meta }
    const pairs: ReadonlyArray<readonly [string, string]> = [
        [TEMPLATE_KEY, settings.templateId.trim()],
        ...FIELDS.map((field) => [PARAM_KEYS[field], settings.params[field].trim()] as const),
    ]
    for (const [key, value] of pairs) {
        if (value === "") delete next[key]
        else next[key] = value
    }
    return next
}

/** An ISO day as ZNS shows dates (`dd/MM/yyyy`); a text that is not an ISO day is passed as it is. */
const znsDateOf = (day: string): string => {
    const match = ISO_DAY.exec(day)
    return match === null ? day : `${match[3]}/${match[2]}/${match[1]}`
}

/** The template data of a renewal notice under the workspace's parameter names; a field without a name is left out. */
export const renewalTemplateData = (params: ZnsRenewalParams, fields: RenewalNoticeFields): Record<string, string> => {
    const values: Readonly<Record<keyof ZnsRenewalParams, string>> = {
        customerName: fields.customerName,
        plan: fields.plan,
        endDate: znsDateOf(fields.endDate),
        amount: String(Math.round(fields.amount)),
        transferContent: fields.transferContent,
        invoiceNumber: fields.invoiceNumber,
    }
    return Object.fromEntries(
        FIELDS.filter((field) => params[field] !== "").map((field) => [params[field], values[field]]),
    )
}
