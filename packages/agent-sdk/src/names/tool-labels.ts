import { TOOL } from "./tool"

/** A text in both product languages. */
interface LabelText {
    /** The Vietnamese words. */
    readonly vi: string
    /** The English words. */
    readonly en: string
}

/**
 * One native tool as the shop owner reads it on an agent's page: whether it acts or reads, a short title and one line. The same shape as a
 * plugin's tool label (`PluginToolLabel` of `@nivo-lite/agent-sdk/installation`).
 */
export interface ToolLabelWords {
    /** Whether the tool changes something (`acts`) or only reads (`reads`). */
    readonly kind: "acts" | "reads"
    /** The name of the tool, a few words. */
    readonly title: LabelText
    /** What it lets the agent do, one short line. */
    readonly summary: LabelText
}

const acts = (title: LabelText, summary: LabelText): ToolLabelWords => ({ kind: "acts", title, summary })
const reads = (title: LabelText, summary: LabelText): ToolLabelWords => ({ kind: "reads", title, summary })

/**
 * The owner-facing words of the native tools the ENGINE defines (contacts, mail, e-invoices, records, files: its `nivo.tool.*` of
 * `NATIVE_TOOL_DEFINITIONS`), keyed by `TOOL`. The engine owns these words with the tools, so it reads them here, not from a plugin; a
 * plugin's own `toolLabels` carry the other tools. A package that lists every tool may spread this map into its own.
 */
export const ENGINE_TOOL_LABELS: Readonly<Record<string, ToolLabelWords>> = {
    [TOOL.customerProfileGet]: reads(
        {
            vi: "Xem t\u00ean v\u00e0 \u1ea3nh c\u1ee7a kh\u00e1ch tr\u00ean k\u00eanh",
            en: "Read the customer's name and picture on the channel",
        },
        {
            vi: "H\u1ecfi k\u00eanh (Zalo...) t\u00ean hi\u1ec3n th\u1ecb v\u00e0 \u1ea3nh \u0111\u1ea1i di\u1ec7n c\u1ee7a m\u1ed9t ng\u01b0\u1eddi tr\u00ean t\u00e0i kho\u1ea3n k\u00eanh; kh\u00f4ng ghi g\u00ec.",
            en: "Asks the channel (Zalo...) for the display name and picture of one person on a channel account; writes nothing.",
        },
    ),
    [TOOL.conversationMessageList]: reads(
        { vi: "\u0110\u1ecdc cu\u1ed9c tr\u00f2 chuy\u1ec7n", en: "Read the conversation" },
        {
            vi: "\u0110\u1ecdc c\u00e1c tin nh\u1eafn g\u1ea7n \u0111\u00e2y c\u1ee7a cu\u1ed9c tr\u00f2 chuy\u1ec7n \u0111ang x\u1eed l\u00fd.",
            en: "Reads the latest lines of the conversation it serves.",
        },
    ),
    [TOOL.contactGet]: reads(
        { vi: "Xem ng\u01b0\u1eddi li\u00ean h\u1ec7", en: "Read the contact" },
        {
            vi: "Xem ng\u01b0\u1eddi \u0111ang x\u1eed l\u00fd: t\u00ean, c\u00e1ch li\u00ean l\u1ea1c v\u00e0 \u0111i\u1ec1u agent \u0111\u00e3 nh\u1edb.",
            en: "Reads the person it serves: name, how to reach them and what agents remember.",
        },
    ),
    [TOOL.contactSearch]: reads(
        { vi: "T\u00ecm ng\u01b0\u1eddi li\u00ean h\u1ec7", en: "Find a contact" },
        {
            vi: "T\u00ecm ng\u01b0\u1eddi theo s\u1ed1 \u0111i\u1ec7n tho\u1ea1i, email ho\u1eb7c t\u00ean; ch\u1ec9 d\u00f9ng n\u1ed9i b\u1ed9.",
            en: "Finds people by phone, mail or name; internal only.",
        },
    ),
    [TOOL.contactUpdate]: acts(
        { vi: "S\u1eeda ng\u01b0\u1eddi li\u00ean h\u1ec7", en: "Update the contact" },
        {
            vi: "S\u1eeda t\u00ean hi\u1ec3n th\u1ecb ho\u1eb7c nh\u00e3n c\u1ee7a ng\u01b0\u1eddi \u0111ang x\u1eed l\u00fd.",
            en: "Changes the display name or the tags of the person it serves.",
        },
    ),
    [TOOL.contactMemoryRemember]: acts(
        { vi: "Ghi nh\u1edb v\u1ec1 ng\u01b0\u1eddi li\u00ean h\u1ec7", en: "Remember about the contact" },
        {
            vi: "Ghi nh\u1edb m\u1ed9t \u0111i\u1ec1u v\u1ec1 ng\u01b0\u1eddi \u0111ang x\u1eed l\u00fd (\u0111\u1ecba ch\u1ec9, ng\u00e0y quan tr\u1ecdng).",
            en: "Remembers a fact about the person it serves (an address, a date).",
        },
    ),
    [TOOL.contactIdentityLink]: acts(
        { vi: "Th\u00eam c\u00e1ch li\u00ean l\u1ea1c", en: "Link an identity" },
        {
            vi: "Th\u00eam s\u1ed1 \u0111i\u1ec7n tho\u1ea1i, email ho\u1eb7c m\u00e3 kh\u00e1ch \u1edf h\u1ec7 th\u1ed1ng kh\u00e1c cho ng\u01b0\u1eddi \u0111ang x\u1eed l\u00fd; \u0111i\u1ec1u kh\u00e1ch t\u1ef1 khai ch\u1ec9 l\u00e0 \u0111\u1ec1 xu\u1ea5t.",
            en: "Adds a phone, a mail or an outside customer id to the person it serves; what the person only says stays a proposal.",
        },
    ),
    [TOOL.contactMerge]: acts(
        { vi: "G\u1ed9p ng\u01b0\u1eddi li\u00ean h\u1ec7", en: "Merge contacts" },
        {
            vi: "G\u1ed9p hai ng\u01b0\u1eddi li\u00ean h\u1ec7 l\u00e0 c\u00f9ng m\u1ed9t ng\u01b0\u1eddi; lu\u00f4n c\u00f3 ng\u01b0\u1eddi duy\u1ec7t.",
            en: "Merges two contacts that are one person; a person decides.",
        },
    ),
    [TOOL.einvoiceList]: reads(
        { vi: "Xem ho\u00e1 \u0111\u01a1n \u0111\u00e3 nh\u1eadn", en: "List received invoices" },
        {
            vi: "Li\u1ec7t k\u00ea c\u00e1c ho\u00e1 \u0111\u01a1n \u0111i\u1ec7n t\u1eed (XML TT78) nh\u1eadn qua th\u01b0: ng\u01b0\u1eddi b\u00e1n, s\u1ed1, ng\u00e0y, t\u1ed5ng ti\u1ec1n; ch\u1ec9 \u0111\u1ecdc.",
            en: "Lists the e-invoices (TT78 XML) received by mail: seller, number, date, totals; read-only.",
        },
    ),
    [TOOL.einvoiceGet]: reads(
        { vi: "Xem m\u1ed9t ho\u00e1 \u0111\u01a1n", en: "Read an invoice" },
        {
            vi: "Xem m\u1ed9t ho\u00e1 \u0111\u01a1n \u0111i\u1ec7n t\u1eed \u0111\u00e3 nh\u1eadn c\u00f9ng c\u00e1c d\u00f2ng c\u1ee7a n\u00f3; ch\u1ec9 \u0111\u1ecdc.",
            en: "Reads one received e-invoice with its lines; read-only.",
        },
    ),
    [TOOL.mailMessageList]: reads(
        { vi: "Xem th\u01b0 m\u1edbi", en: "List new mail" },
        {
            vi: "Xem th\u01b0 m\u1edbi trong h\u1ed9p th\u01b0 \u0111\u01b0\u1ee3c g\u1eafn: ng\u01b0\u1eddi g\u1eedi, ti\u00eau \u0111\u1ec1, \u0111o\u1ea1n \u0111\u1ea7u; kh\u00f4ng \u0111\u00e1nh d\u1ea5u \u0111\u00e3 \u0111\u1ecdc.",
            en: "Lists new mail in the attached mailboxes: sender, subject, opening; never marks it read.",
        },
    ),
    [TOOL.mailMessageGet]: reads(
        { vi: "\u0110\u1ecdc m\u1ed9t th\u01b0", en: "Read a mail" },
        {
            vi: "\u0110\u1ecdc n\u1ed9i dung m\u1ed9t th\u01b0 trong h\u1ed9p th\u01b0 \u0111\u01b0\u1ee3c g\u1eafn; kh\u00f4ng \u0111\u00e1nh d\u1ea5u, kh\u00f4ng chuy\u1ec3n, kh\u00f4ng xo\u00e1.",
            en: "Reads one mail of an attached mailbox; never marks, moves or deletes it.",
        },
    ),
    [TOOL.recordGet]: reads(
        { vi: "Xem m\u1ed9t b\u1ea3n ghi", en: "Read a record" },
        {
            vi: "Xem m\u1ed9t b\u1ea3n ghi c\u1ee7a ch\u00ednh agent n\u00e0y.",
            en: "Reads one record of this very agent.",
        },
    ),
    [TOOL.recordList]: reads(
        { vi: "Xem c\u00e1c b\u1ea3n ghi", en: "List records" },
        {
            vi: "Li\u1ec7t k\u00ea c\u00e1c b\u1ea3n ghi c\u1ee7a ch\u00ednh agent n\u00e0y, c\u00f3 l\u1ecdc v\u00e0 s\u1eafp x\u1ebfp.",
            en: "Lists this agent's own records, filtered and ordered.",
        },
    ),
    [TOOL.recordCreate]: acts(
        { vi: "T\u1ea1o b\u1ea3n ghi", en: "Create a record" },
        {
            vi: "T\u1ea1o m\u1ed9t b\u1ea3n ghi m\u1edbi cho ch\u00ednh agent n\u00e0y.",
            en: "Creates one new record for this very agent.",
        },
    ),
    [TOOL.recordUpdate]: acts(
        { vi: "S\u1eeda b\u1ea3n ghi", en: "Change a record" },
        {
            vi: "S\u1eeda c\u00e1c tr\u01b0\u1eddng c\u1ee7a m\u1ed9t b\u1ea3n ghi c\u1ee7a ch\u00ednh agent n\u00e0y.",
            en: "Changes fields of one of this agent's own records.",
        },
    ),
    [TOOL.filePut]: acts(
        { vi: "L\u01b0u t\u1ec7p v\u00e0o b\u1ea3n ghi", en: "Store a file in a record" },
        {
            vi: "L\u01b0u m\u1ed9t t\u1ec7p (do nh\u00e0 cung c\u1ea5p tr\u1ea3 v\u1ec1) v\u00e0o tr\u01b0\u1eddng t\u1ec7p c\u1ee7a m\u1ed9t b\u1ea3n ghi c\u1ee7a agent.",
            en: "Stores a file a provider returned in a file field of one of the agent's records.",
        },
    ),
    [TOOL.fileLink]: acts(
        { vi: "G\u1eafn t\u1ec7p v\u00e0o b\u1ea3n ghi", en: "Attach a file to a record" },
        {
            vi: "G\u1eafn m\u1ed9t t\u1ec7p \u0111\u00e3 c\u00f3 trong kho v\u00e0o tr\u01b0\u1eddng t\u1ec7p c\u1ee7a m\u1ed9t b\u1ea3n ghi c\u1ee7a agent.",
            en: "Attaches a file already in the store to a file field of one of the agent's records.",
        },
    ),
    [TOOL.fileGet]: reads(
        { vi: "L\u1ea5y li\u00ean k\u1ebft t\u1ec7p", en: "Get a file link" },
        {
            vi: "L\u1ea5y li\u00ean k\u1ebft t\u1ea1m th\u1eddi \u0111\u1ec3 \u0111\u1ecdc ho\u1eb7c g\u1eedi t\u1ec7p c\u1ee7a m\u1ed9t b\u1ea3n ghi.",
            en: "Gets a short-lived link to read or send the file a record holds.",
        },
    ),
}
