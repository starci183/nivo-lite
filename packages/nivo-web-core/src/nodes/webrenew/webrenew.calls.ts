import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject, JsonValue } from "@nivo-lite/agent-sdk/schema"
import {
    toolDeclined,
    toolOk,
    toolRefused,
    type DeclinedAnswer,
    type NodeContext,
    type ToolAnswer,
    type ToolAnswerOf,
    type ToolDeclined,
} from "@nivo-lite/agent-sdk/template"
import { sayToCustomer, type SayResult } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { CRM_NIVOWEB } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, REPLY_MAX } from "./renew-shapes"

/**
 * The calls the Renewal steps share: reading members of a tool's answer, choosing how a customer is reached FROM DATA (an exact
 * presence check on the ids the run carries or on the CRM customer the step read), the one send, the one team post and the one
 * reminder record. No provider is compared and no channel is chosen here: a person is told through the shared helper `sayToCustomer`
 * (`nivo.tool.customer.message.send` addresses the PERSON by `contactId`, or the person the run serves when none is named; the engine
 * picks the channel and account from the contact), a customer known only by a mail address with `nivo.tool.mail.message.send` (the mail
 * tool raises a draft a person sends). The channel a message went through is the send's own receipt (`value.channel`: the send is a NIVO
 * effect, its `via` names no account); a mail's channel is e-mail.
 */

/** The refusal a person's "no" on a call a shop set to `ask` answers (ADDENDUM 4.2): a decision the node returns, never a failure. */
export const DECLINED = "declined"

/**
 * True when a person declined the approval the call asked for (a shop's own `ask`): the answer's `declined` member. It narrows the
 * declined answer out of the rest, so the code after it reads `refusal` of a real refusal only.
 */
export const isDeclined = <A extends { readonly ok: boolean; readonly declined?: boolean | undefined }>(
    answer: A,
): answer is Extract<A, ToolDeclined> => !answer.ok && answer.declined === true

/** The channel of a mail as the CRM names it (`RecordReminderRequest.channel`): a mail send's draft and a mailbox reply alike. */
export const MAIL_CHANNEL = "email"

/** A tool's answer as an object, or null when it is not one (a list, a scalar, nothing). */
const objectOf = (value: JsonValue | undefined): JsonObject | null =>
    typeof value === "object" && value !== null && !isList(value) ? value : null

/** Whether a JSON value is a list (`Array.isArray` does not narrow a readonly list). */
const isList = (value: JsonValue): value is ReadonlyArray<JsonValue> => Array.isArray(value)

/** A text member of a tool's answer, or null when it is absent or blank. */
export const textOf = (value: JsonValue | undefined, member: string): string | null => {
    const found = objectOf(value)?.[member]
    return typeof found === "string" && found.trim() !== "" ? found : null
}

/** A number member of a tool's answer, or null. */
export const numberOf = (value: JsonValue | undefined, member: string): number | null => {
    const found = objectOf(value)?.[member]
    return typeof found === "number" ? found : null
}

/** A boolean member of a tool's answer, or null. */
export const booleanOf = (value: JsonValue | undefined, member: string): boolean | null => {
    const found = objectOf(value)?.[member]
    return typeof found === "boolean" ? found : null
}

/** The records of an array member of a tool's answer (`items`, `contacts`), objects only. */
export const recordsOf = (value: JsonValue | undefined, member: string): ReadonlyArray<JsonObject> => {
    const found = objectOf(value)?.[member]
    return Array.isArray(found)
        ? found.flatMap((one: JsonValue): ReadonlyArray<JsonObject> => {
              const record = objectOf(one)
              return record === null ? [] : [record]
          })
        : []
}

/**
 * How a customer is reached, as the data says: the person the run serves, answered where the run was woken (`conversation`: the route
 * the run carries, which the send defaults to), a named person (`person`: the core contact), or only a mail address.
 */
export type CustomerReach =
    | { readonly by: "conversation"; readonly conversationId: string }
    | { readonly by: "person"; readonly contactId: string }
    | { readonly by: "mail"; readonly to: string }

/** The reach the run's own ids give: the route it was woken on first, else the person; null when the run carries neither. */
export const reachOfIds = (conversationId: string | null, contactId: string | null): CustomerReach | null => {
    if (conversationId !== null) return { by: "conversation", conversationId }
    if (contactId !== null) return { by: "person", contactId }
    return null
}

/**
 * The reach a CRM customer gives (the answer of `nivo.api.crm.nivoweb.get.customers.code`): a contact that carries a NIVO customer id (the
 * contact's `zaloId`, ASSUMPTIONS-F T2: the id of the core contact, the person) is a person the send can address; else the customer's own e-mail, else a contact's e-mail,
 * is a mail; null when none. Exact presence checks only: no word of the record is read for meaning, no provider is compared.
 */
export const reachOfCustomer = (customer: JsonValue): CustomerReach | null => {
    const contacts = recordsOf(customer, "contacts")
    const person = contacts.map((contact) => textOf(contact, "zaloId")).find((id): id is string => id !== null)
    if (person !== undefined) return { by: "person", contactId: person }
    const mail =
        textOf(customer, "email") ??
        contacts.map((contact) => textOf(contact, "email")).find((to): to is string => to !== null)
    return mail === undefined ? null : { by: "mail", to: mail }
}

/**
 * The form of the words a reach takes: a chat line, or a mail with a subject. What the agent is told to write, never a provider.
 */
export type WordsForm = "chat" | "mail"

/** The form of a reach's words. */
export const formOf = (reach: CustomerReach): WordsForm => (reach.by === "mail" ? "mail" : "chat")

/** The words the agent writes for the customer: the subject (mail only) and the text. */
export type CustomerWords = {
    /** The mail's subject; null for a chat line. */
    readonly subject: string | null
    /** The text, in the customer's language. */
    readonly text: string
}

/** The schema of the agent's words for a reach of `form`. */
export const wordsSchemaOf = (form: WordsForm): z.ZodType<CustomerWords> =>
    z.object({
        subject:
            form === "mail"
                ? z.string().min(1).max(LINE_MAX).describe("The mail's subject, short, in the customer's language.")
                : z.null().describe("Always null: a chat line has no subject."),
        text: z
            .string()
            .min(1)
            .max(REPLY_MAX)
            .describe("The words to the customer, in their language and the shop's voice."),
    })

/** What a customer send answers: the person send's (the receipt as the value) or the mail send's answer, a person's decline included. */
export type CustomerSendAnswer = ToolAnswer<JsonObject> | DeclinedAnswer | ToolAnswerOf<typeof TOOL.mailMessageSend>

/** What a send left: the channel it went through, and the id the send answered. */
export type Told = {
    /**
     * The channel the message went through: the send receipt's `channel` (`zalo`, `telegram`, `facebook`, `instagram`,
     * `website`), `email` for a mail; null when the send's answer named none.
     */
    readonly channel: string | null
    /** The message (or mail draft) id the send answered. */
    readonly messageRef: string | null
}

/** The business record a mail is about (`ref` of `nivo.tool.mail.message.send`): its kind and its code, as the record names it. */
export type MailAbout = {
    /** The kind of record: `service` (a reminder), `renewal` (a renewal request). */
    readonly kind: "service" | "renewal"
    /** Its code or id. */
    readonly code: string
}

/** The send's answer as the nodes read an answer: the receipt as the value, a refusal, or the person's decline. */
const answerOf = (said: SayResult): ToolAnswer<JsonObject> | DeclinedAnswer => {
    if (said.ok) return toolOk(said.facts)
    return said.declined ? toolDeclined(said.facts) : toolRefused(said.refusal, said.facts)
}

/**
 * Sends the customer the words by the reach: ONE call of the shared helper `sayToCustomer` (a person named by `contactId`, or the
 * person the run serves) or of the mail send (`{ to, subject, body, ref? }`: the draft a person sends, carrying the record it is about;
 * `about` null for a reach by the run's own ids, which is never a mail). These nodes belong to no chatbot, so the helper writes no
 * chatbot line. The answer is the caller's to read.
 */
export const tellCustomer = async (
    context: Pick<NodeContext, "tools" | "fail" | "run" | "workspace">,
    reach: CustomerReach,
    words: CustomerWords,
    about: MailAbout | null,
): Promise<CustomerSendAnswer> => {
    if (reach.by === "mail") {
        return context.tools.call(TOOL.mailMessageSend, {
            to: reach.to,
            subject: words.subject ?? "",
            body: words.text,
            ...(about === null ? {} : { ref: { kind: about.kind, code: about.code } }),
        })
    }
    return answerOf(
        await sayToCustomer(context, { text: words.text, ...(reach.by === "person" ? { contactId: reach.contactId } : {}) }),
    )
}

/**
 * What a send that went through left, from its own facts: the person send answers the receipt `{ state, reason, contactId, channel,
 * accountId, routeId, providerMessageId, at, sendKey }` (the message's reference is the provider's id, else the once-key), the mail send
 * `{ emailMessageId, status }` (the send through the workspace's mail account: its channel is e-mail).
 */
export const toldOf = (reach: CustomerReach, answer: Extract<CustomerSendAnswer, { ok: true }>): Told =>
    reach.by === "mail"
        ? { channel: MAIL_CHANNEL, messageRef: textOf(answer.value, "emailMessageId") }
        : {
              channel: textOf(answer.value, "channel"),
              messageRef: textOf(answer.value, "providerMessageId") ?? textOf(answer.value, "sendKey"),
          }

/** One line for the team as the agent writes it: a short title and the text. */
export type TeamLine = {
    /** A short title. */
    readonly title: string
    /** The text, in the team's language. */
    readonly text: string
}

/** The schema of one line for the team. */
export const teamLineSchema: z.ZodType<TeamLine> = z.object({
    title: z.string().min(1).max(120).describe("A short title, in the team's language."),
    text: z.string().min(1).max(REPLY_MAX).describe("The text, in the team's language."),
})

/** The shape of the team post: `notify` tells, `ask` asks a person to act, `report` is the round's result. */
export type TeamIntent = "notify" | "ask" | "report"

/** Posts ONE plain-words message to the team. `audience` "own" keeps it to the agent's own people. */
export const postTeam = (
    context: Pick<NodeContext, "tools">,
    intent: TeamIntent,
    line: TeamLine,
    audience?: "own",
): Promise<ToolAnswerOf<typeof TOOL.teamMessagePost>> =>
    context.tools.call(TOOL.teamMessagePost, {
        kind: "message.text",
        intent,
        ...(audience === undefined ? {} : { audience }),
        title: line.title,
        text: line.text,
    })

/** The outcome a reminder record names in the CRM. */
export type ReminderOutcome = "sent" | "quoted" | "declined" | "answered"

/**
 * One reminder record: the service, the channel it went through (omitted when not known), the outcome and the message it names.
 */
export type ReminderRecord = {
    /** The service's code. */
    readonly serviceCode: string
    /** The channel the customer was reached or answered through, as the send answered it; null when not known. */
    readonly channel: string | null
    /** The outcome. */
    readonly outcome: ReminderOutcome
    /** The message, mail draft or mail the record names; null when none. */
    readonly messageRef: string | null
}

/** Records ONE reminder of a service in the CRM (`nivo.api.crm.nivoweb.post.services.code.reminders`). */
export const recordReminder = (
    context: Pick<NodeContext, "tools">,
    record: ReminderRecord,
): Promise<ToolAnswerOf<typeof CRM_NIVOWEB.post_services_code_reminders>> =>
    context.tools.call(CRM_NIVOWEB.post_services_code_reminders, {
        code: record.serviceCode,
        ...(record.channel === null ? {} : { channel: record.channel }),
        outcome: record.outcome,
        ...(record.messageRef === null ? {} : { messageRef: record.messageRef }),
    })

/** The CRM's prices a step may quote: only the rows of the price sheet (`priceSource` `price_sheet`), of one class when given. */
export const quotablePricesOf = (prices: JsonValue, serviceClass: string | null): ReadonlyArray<JsonObject> =>
    recordsOf(prices, "items").filter(
        (row) =>
            textOf(row, "priceSource") === "price_sheet" &&
            (serviceClass === null || textOf(row, "serviceClass") === serviceClass),
    )
