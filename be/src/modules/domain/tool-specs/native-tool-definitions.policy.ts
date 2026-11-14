import { ENGINE_TOOL_LABELS, TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import { defineTool, type ToolDefinition } from "@nivo-lite/agent-sdk/node"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { FILE_GET_SCHEMA, FILE_LINK_SCHEMA, FILE_PUT_SCHEMA } from "@modules/domain/native-tools/file-native.schema"
import {
    RECORD_CREATE_SCHEMA,
    RECORD_GET_SCHEMA,
    RECORD_LIST_SCHEMA,
    RECORD_UPDATE_SCHEMA,
} from "@modules/domain/native-tools/record-native.schema"

/*
 * The definitions of the engine's own native tools that a template node's agent is SHOWN and the legacy runner PARSES (args, answers,
 * `mutates`): the two mail reads (`native-tools/mail-native.*`), the two e-invoice reads (`tools/adapters/einvoice-native.*`) and
 * the contacts (`contact-tools/*`). concept.tool-naming#nodeFrame2026_11_12: the engine alone defines tools,
 * packages only name them, so these live here (they were the NIVO Web plugin's SEAM files until 2026-11-13) and the engine's
 * installation reader (`installed-plugins/installed.policy.ts`) joins them to what the plugins install, so every reader of
 * `INSTALLED.nodeInstall().tools` / `INSTALLED.toolOf` knows them as before. Class, owners, refusals and modes stay the tool specs'
 * (`TOOL_SPECS`); the gateway still validates every call with the native's own schema. Each argument schema here takes exactly what
 * its native takes, member by member (the spec probes both); the ids the door fills (a read's conversation and contact) are no
 * member of a definition.
 */

/** The title a model reads for one of these tools: the engine's own label line (`ENGINE_TOOL_LABELS` of agent-sdk), else the id. */
const titleOf = (id: ToolId): SpecText => {
    const label = ENGINE_TOOL_LABELS[id]
    return label === undefined ? { vi: id, en: id } : { vi: label.summary.vi, en: label.summary.en }
}

/** A bounded text an adapter may leave empty. */
const text = (max: number): z.ZodNullable<z.ZodString> => z.string().max(max).nullable()

// ---- The e-invoice reads (`einvoice-native.schema.ts`).

const einvoiceListArgs = z
    .strictObject({
        since: z.iso.date().max(10).optional().describe("Only invoices received on or after this day (YYYY-MM-DD)."),
        limit: z.number().int().min(1).max(50).optional().describe("The most invoices in the answer; 20 when left out."),
    })
    .describe("The e-invoices (TT78 XML) the workspace received by mail, newest first. Read-only.")

const einvoiceGetArgs = z
    .strictObject({ id: z.string().min(1).max(200).describe("The invoice, by the id the list answered.") })
    .describe("One received e-invoice with its lines. Read-only.")

const einvoiceListResult = z.looseObject({
    invoices: z
        .array(
            z.looseObject({
                id: z.string().max(200),
                sellerTaxCode: text(40),
                sellerName: text(400),
                number: text(60),
                series: text(60),
                issuedOn: text(40),
                totalVnd: z.number().int().nullable(),
                vatVnd: z.number().int().nullable(),
            }),
        )
        .max(50),
})

const einvoiceGetResult = z.looseObject({
    found: z.boolean(),
    id: z.string().max(200).optional(),
    number: text(60).optional(),
    issuedOn: text(40).optional(),
    totalVnd: z.number().int().nullable().optional(),
    lines: z.array(z.looseObject({ name: z.string().max(400), amountVnd: z.number().int() })).max(200).optional(),
})

/** `nivo.tool.einvoice.list`: the received e-invoices. */
const einvoiceListTool: ToolDefinition = defineTool({
    id: TOOL.einvoiceList,
    title: titleOf(TOOL.einvoiceList),
    args: einvoiceListArgs,
    result: einvoiceListResult,
    mutates: false,
})

/** `nivo.tool.einvoice.get`: one received e-invoice with its lines. */
const einvoiceGetTool: ToolDefinition = defineTool({
    id: TOOL.einvoiceGet,
    title: titleOf(TOOL.einvoiceGet),
    args: einvoiceGetArgs,
    result: einvoiceGetResult,
    mutates: false,
})

// ---- The conversation with the customer of the run's route (`channels/customer-message-native.schema.ts`): the engine's own lines.

/**
 * `nivo.tool.conversation.message.list` (owner ruling R26: served by the ENGINE, no plugin): the lines of the route this run serves, both
 * directions, newest first, sent lines only once delivered; an optional lower limit in time. Takes no route id.
 */
const conversationMessageListTool: ToolDefinition = defineTool({
    id: TOOL.conversationMessageList,
    title: titleOf(TOOL.conversationMessageList),
    args: z.strictObject({
        limit: z.number().int().min(1).max(50).optional().describe("The most lines, newest first; 20 when left out."),
        since: z.iso.datetime().optional().describe("Only the lines said from this instant on (ISO 8601); the whole conversation when left out."),
    }),
    result: z.looseObject({
        notice: z.string().max(2000),
        source: z.string().max(100),
        asOf: z.string().max(40),
        facts: z
            .array(
                z.looseObject({
                    role: z.enum(["user", "agent"]),
                    direction: z.enum(["from_person", "to_person"]),
                    text: z.string().max(1000),
                    at: z.string().max(40),
                    files: z.array(z.looseObject({ url: z.string().max(2000), contentType: z.string().max(200) })).optional(),
                    agentId: z.string().max(100).nullable(),
                    memberId: z.string().max(100).nullable(),
                }),
            )
            .max(50),
    }),
    mutates: false,
})

// ---- What a channel says of a person on it (`channels/customer-profile-native.schema.ts`): the provider's profile read, through the registry.

/** `nivo.tool.customer.profile.get`: the display name and picture link of a person on a channel account, each empty when the channel gives none. */
const customerProfileGetTool: ToolDefinition = defineTool({
    id: TOOL.customerProfileGet,
    title: titleOf(TOOL.customerProfileGet),
    args: z.strictObject({
        accountId: z.string().min(1).max(200).describe("The channel account (connection) the person is on."),
        personId: z.string().min(1).max(200).describe("The channel's own id of the person on that account."),
    }),
    result: z.looseObject({
        name: z.string().max(200),
        picture: z.string().max(2000),
    }),
    mutates: false,
})

// ---- The contacts (`contact-tools/contact-tools.schema.ts`): the engine's person tools.

/** A context read's answer: the notice, the source, when it was read and the facts. */
const contextResult = z.looseObject({
    notice: z.string().max(2000),
    source: z.string().max(100),
    asOf: z.string().max(40),
    facts: z.array(z.record(z.string(), z.unknown())).max(50),
})

/** `nivo.tool.contact.get`: the person this run serves. Takes no id: the door fills the run's own. */
const contactGetTool: ToolDefinition = defineTool({
    id: TOOL.contactGet,
    title: titleOf(TOOL.contactGet),
    args: z.strictObject({}).describe("Takes no contact id: it always reads the person this run serves."),
    result: contextResult,
    mutates: false,
})

/** `nivo.tool.contact.search`: people of the workspace by an exact phone or mail, a name prefix, or an id. Internal only. */
const contactSearchTool: ToolDefinition = defineTool({
    id: TOOL.contactSearch,
    title: titleOf(TOOL.contactSearch),
    args: z.strictObject({
        query: z.string().min(1).max(320).optional().describe("A phone or a mail address (any written form), or the start of a name."),
        contactId: z.string().min(1).max(200).optional().describe("One contact by its id, from an earlier answer."),
        limit: z.number().int().min(1).max(20).optional().describe("The most people in the answer; 10 when left out."),
    }),
    result: contextResult,
    mutates: false,
})

/** `nivo.tool.contact.update`: the display name and the tags of the person this run serves. */
const contactUpdateTool: ToolDefinition = defineTool({
    id: TOOL.contactUpdate,
    title: titleOf(TOOL.contactUpdate),
    args: z.strictObject({
        contactId: z.string().min(1).max(200).optional().describe("Only for an internal run that serves no person: the contact by its id."),
        displayName: z.string().min(1).max(200).nullable().optional().describe("The name the person is shown by; null clears it."),
        tags: z.array(z.string().min(1).max(40)).max(20).optional().describe("The whole set of tags."),
    }),
    result: z.looseObject({ updated: z.boolean(), contactId: z.string().max(100) }),
    mutates: true,
})

/** `nivo.tool.contact.memory.remember`: facts about the person this run serves. */
const contactRememberTool: ToolDefinition = defineTool({
    id: TOOL.contactMemoryRemember,
    title: titleOf(TOOL.contactMemoryRemember),
    args: z.strictObject({
        contactId: z.string().min(1).max(200).optional().describe("Only for an internal run that serves no person: the contact by its id."),
        facts: z.record(z.string().min(1).max(60), z.json()).describe("The facts by name; the newest value of a fact wins."),
    }),
    result: z.looseObject({ remembered: z.array(z.string().max(60)).max(20), contactId: z.string().max(100) }),
    mutates: true,
})

/** `nivo.tool.contact.identity.link`: a way to reach the person, or a link token they presented. */
const contactLinkTool: ToolDefinition = defineTool({
    id: TOOL.contactIdentityLink,
    title: titleOf(TOOL.contactIdentityLink),
    args: z.strictObject({
        contactId: z.string().min(1).max(200).optional().describe("Only for an internal run that serves no person: the contact by its id."),
        kind: z.enum(["phone", "email", "external"]).optional().describe("What the value is."),
        value: z.string().min(1).max(320).optional().describe("The phone, the mail address, or the outside system's customer id as it gave it."),
        account: z.uuid().optional().describe("For an outside id: the account it belongs to, when the workspace holds several."),
        token: z.string().min(8).max(200).optional().describe("A one-time link token the person presented."),
    }),
    result: z.looseObject({ outcome: z.string().max(40), contactId: z.string().max(100) }),
    mutates: true,
})

/** `nivo.tool.contact.merge`: two contacts become one, on a person's decision. */
const contactMergeTool: ToolDefinition = defineTool({
    id: TOOL.contactMerge,
    title: titleOf(TOOL.contactMerge),
    args: z.strictObject({
        intoContactId: z.string().min(1).max(200).describe("The contact that takes the other over."),
        fromContactId: z.string().min(1).max(200).describe("The contact that goes."),
    }),
    result: z.looseObject({ merged: z.boolean(), contactId: z.string().max(100), reason: z.string().max(40) }),
    mutates: true,
})

// ---- The mail reads (`mail-native.schema.ts`).

/** What the list is asked for: one attached mailbox or every one, a point to page from (with its mailbox), and how many. */
interface MailListArgs {
    /** One attached mailbox (its connection id); absent, every mailbox the agent may read, in turn. */
    readonly mailbox?: string | undefined
    /** A `next` an earlier answer gave for `mailbox`: pages without moving the saved point. */
    readonly after?: string | undefined
    /** The most mails in the answer. */
    readonly limit?: number | undefined
}

/** What the read is asked for: one mail by the id the list answered, and how much of its text. */
interface MailGetArgs {
    /** The mail. */
    readonly id: string
    /** The most characters of its text. */
    readonly maxChars?: number | undefined
}

/** A person on a mail as the adapter answers it. */
const person = z.looseObject({ name: z.string().max(400).nullable(), address: z.string().max(400).nullable() })

/** The head of a mail as both tools answer it; members the adapter adds later pass through. */
const head = z.looseObject({
    id: z.string().max(100),
    mailbox: z.string().max(100),
    date: z.string().max(40).nullable(),
    from: person.nullable(),
    subject: z.string().max(400),
    hasAttachments: z.boolean(),
})

const mailListResult = z.looseObject({
    count: z.number().int().nonnegative(),
    mailboxes: z
        .array(
            z.looseObject({
                id: z.string().max(100),
                name: z.string().max(400),
                next: z.string().max(200).nullable(),
                more: z.boolean(),
            }),
        )
        .max(20),
    messages: z.array(head.extend({ snippet: z.string().max(400) })).max(25),
    notice: z.string().max(2000),
})

const mailGetResult = head.extend({
    text: z.string().max(20_000),
    truncated: z.boolean(),
    quotedLines: z.number().int().nonnegative(),
    notice: z.string().max(2000),
})

const mailListArgs: z.ZodType<MailListArgs> = z
    .object({
        mailbox: z.uuid().optional().describe("One attached mailbox by its id; leave it out to read every attached mailbox in turn."),
        after: z
            .string()
            .min(3)
            .max(120)
            .optional()
            .describe("Only to page: a `next` an earlier answer gave, with its `mailbox`. Leave it out to get what is new."),
        limit: z.number().int().min(1).max(25).optional().describe("The most mails in the answer; 10 when left out."),
    })
    .strict()
    .refine((args) => args.after === undefined || args.mailbox !== undefined, { path: ["after"] })
    .describe("The new mails of your attached mailboxes, oldest first, head and opening only. Each mail is handed to you once.")

const mailGetArgs: z.ZodType<MailGetArgs> = z
    .object({
        id: z.uuid().describe("The mail, by the id the list answered."),
        maxChars: z.number().int().min(500).max(12_000).optional().describe("The most characters of its text; 4000 when left out."),
    })
    .strict()
    .describe("One mail of an attached mailbox with its plain text, bounded. Read-only.")

/** `nivo.tool.mail.message.list`: the new mails of the attached mailboxes. Reads only; the mailbox is never marked. */
const mailMessageListTool: ToolDefinition = defineTool({
    id: TOOL.mailMessageList,
    title: titleOf(TOOL.mailMessageList),
    args: mailListArgs,
    result: mailListResult,
    mutates: false,
})

/** `nivo.tool.mail.message.get`: one mail with its text. Reads only; the mailbox is never marked, moved or deleted. */
const mailMessageGetTool: ToolDefinition = defineTool({
    id: TOOL.mailMessageGet,
    title: titleOf(TOOL.mailMessageGet),
    args: mailGetArgs,
    result: mailGetResult,
    mutates: false,
})

// ---- The record and file tools (`native-tools/record-native.*`, `file-native.*`): default for every node, scoped to the calling agent.

const recordResult = z.looseObject({ record: z.looseObject({}) })
const recordsResult = z.looseObject({ records: z.array(z.looseObject({})), next: z.string().nullable().optional() })
const fileResult = z.looseObject({ file: z.looseObject({}) })

const nativeRecordTool = (
    id: ToolId,
    args: z.ZodType<Record<string, unknown>>,
    result: z.ZodType,
    mutates: boolean,
): ToolDefinition => defineTool({ id, title: titleOf(id), args, result, mutates })

/** `nivo.tool.record.get`: one of the calling agent's records. */
const recordGetTool = nativeRecordTool(TOOL.recordGet, RECORD_GET_SCHEMA, recordResult, false)
/** `nivo.tool.record.list`: a page of the calling agent's records. */
const recordListTool = nativeRecordTool(TOOL.recordList, RECORD_LIST_SCHEMA, recordsResult, false)
/** `nivo.tool.record.create`: a new record of the calling agent. */
const recordCreateTool = nativeRecordTool(TOOL.recordCreate, RECORD_CREATE_SCHEMA, recordResult, true)
/** `nivo.tool.record.update`: changes fields of one of the calling agent's records. */
const recordUpdateTool = nativeRecordTool(TOOL.recordUpdate, RECORD_UPDATE_SCHEMA, recordResult, true)
/** `nivo.tool.file.put`: stores a staged file or a file at a public address in a record's `file` field. */
const filePutTool = nativeRecordTool(TOOL.filePut, FILE_PUT_SCHEMA, fileResult, true)
/** `nivo.tool.file.link`: attaches a file already in the store to a record's `file` field. */
const fileLinkTool = nativeRecordTool(TOOL.fileLink, FILE_LINK_SCHEMA, fileResult, true)
/** `nivo.tool.file.get`: a short-lived signed address of a record's file. */
const fileGetTool = nativeRecordTool(TOOL.fileGet, FILE_GET_SCHEMA, fileResult, false)

/** The definitions of the engine's native tools no package defines, joined to the installation by `INSTALLED`. */
export const NATIVE_TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
    mailMessageListTool,
    mailMessageGetTool,
    einvoiceListTool,
    einvoiceGetTool,
    conversationMessageListTool,
    customerProfileGetTool,
    contactGetTool,
    contactSearchTool,
    contactUpdateTool,
    contactRememberTool,
    contactLinkTool,
    contactMergeTool,
    recordGetTool,
    recordListTool,
    recordCreateTool,
    recordUpdateTool,
    filePutTool,
    fileLinkTool,
    fileGetTool,
]
