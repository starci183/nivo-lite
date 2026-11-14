import { z } from "zod"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import { jsonBodySchema, jsonRecordSchema } from "@modules/platform/primitives"
import { WORKSPACE_THEME_MODES } from "@modules/domain/workspace-settings"
import type { ExposedNivoApi, HiddenNivoApi, NivoApiDeclarations, NivoApiEffect } from "./nivo-api.contracts"
import {
    answer,
    BRAIN_NODES_MAX,
    contact,
    cursor,
    fileKey,
    fileTarget,
    idText,
    item,
    labelText,
    locale,
    longText,
    rows,
    schemaJson,
    themeAnswer,
    themeShape,
    uuid,
} from "./nivo-api.schema"

/** A file call's answer: the signed target or the reference the store gives, members as it sends them. */
const fileAnswer = answer({})

/** The most rows an answer holds where its op's own input bounds the page (`size` 50, `first` 100, `limit` 50 / 100). */
const CONTACTS_PAGE_MAX = 50
const MESSAGES_PAGE_MAX = 100
const STOPS_PAGE_MAX = 50
const ROWS_PAGE_MAX = 100

const hidden = (summary: string, never: HiddenNivoApi["never"]): HiddenNivoApi => ({ exposed: false, summary, never })

/** An exposed op with the exact types of its validators (the executor reads its arguments' type from them). */
export type TypedExposedNivoApi<I extends z.ZodType, O extends z.ZodType> = ExposedNivoApi & {
    /** The validator of the arguments of the op. */
    readonly input: I
    /** The validator of the result of the op. */
    readonly output: O
}

const read = <I extends z.ZodType, O extends z.ZodType>(
    summary: string,
    input: I,
    output: O,
    role: ExposedNivoApi["role"],
    customerText: boolean,
): TypedExposedNivoApi<I, O> => ({
    exposed: true,
    summary,
    input,
    output,
    readOnly: true,
    destructive: false,
    idempotent: true,
    role,
    customerText,
})

const write = <I extends z.ZodType, O extends z.ZodType>(
    summary: string,
    input: I,
    output: O,
    role: ExposedNivoApi["role"],
    effect: NivoApiEffect,
): TypedExposedNivoApi<I, O> => ({
    exposed: true,
    summary,
    input,
    output,
    readOnly: false,
    destructive: effect.destructive,
    idempotent: effect.idempotent,
    role,
    customerText: false,
})

/**
 * The ONE declaration of every NIVO data op (`nivo.api.nivo.*`): the outbound MCP catalogue is generated from it at boot (never
 * hand-listed), each op maps 1:1 to the GraphQL operation `NIVO_API_GRAPHQL` names, and its executor calls that operation's application
 * handler. Total over `NIVO_API` by its type. An op without an application handler yet has no name here (see `.starciwork/concepts/
 * mcp.md` "Not exposed"); an op that must never leave NIVO is declared `exposed: false` with why.
 */
export const NIVO_API_DECLARATIONS = {
    [NIVO_API.contact.list]: read(
        "Search the workspace's contacts (people from every channel) by name, phone, email or tag; paginated.",
        z.strictObject({
            search: z.string().max(200).optional().describe("Text to find in names, identities and tags."),
            cursor: cursor.optional(),
            size: z.number().int().min(1).max(50).optional(),
        }),
        answer({ contacts: rows(contact, CONTACTS_PAGE_MAX), next: cursor.nullable() }),
        "manager",
        true,
    ),
    [NIVO_API.contact.get]: read(
        "One contact with its identities, conversations, agent memory and 'maybe same person' suggestions.",
        z.strictObject({ id: uuid }),
        answer({ detail: item.nullable() }),
        "manager",
        true,
    ),
    [NIVO_API.contact.blockList]: read(
        "What each installed agent's module knows about one contact (the contact detail's module blocks): per agent the blocks its module declares (title, the generic block as a spec node, the first rows its read answered for the person, how many and whether there are more). An agent whose read the caller may not run is left out; a contact the workspace does not hold is not found.",
        z.strictObject({ contactId: uuid }),
        answer({ agents: rows(item) }),
        "manager",
        true,
    ),
    [NIVO_API.customerMessage.list]: read(
        "The conversation with a person on one route (this person on one channel account), both directions, newest first: what the person said and what any agent or person of the shop told them, with when, who and whether it was delivered; paginated, optionally from an instant on.",
        z.strictObject({
            routeId: uuid,
            after: cursor.optional(),
            since: z.iso.datetime().optional().describe("Only the lines said from this instant on (ISO 8601)."),
            limit: z.number().int().min(1).max(MESSAGES_PAGE_MAX).optional(),
        }),
        answer({ rows: rows(item, MESSAGES_PAGE_MAX), next: cursor.nullable() }),
        "manager",
        true,
    ),
    [NIVO_API.contact.update]: write(
        "Rename a contact or replace its tags.",
        z.strictObject({
            id: uuid,
            displayName: z.string().max(200).nullable().optional(),
            tags: z.array(z.string().max(40)).max(20).optional(),
        }),
        contact,
        "manager",
        { destructive: false, idempotent: true },
    ),
    [NIVO_API.contact.identityLink]: write(
        "Link a phone, email or outside customer id to a contact as a person's decision (it may merge two contacts).",
        z.strictObject({
            contactId: uuid,
            kind: z.enum(["phone", "email", "external"]),
            value: z.string().min(1).max(320),
            account: uuid.optional().describe("The connected account an external id belongs to."),
        }),
        answer({ outcome: labelText, contactId: idText }),
        "manager",
        { destructive: true, idempotent: true },
    ),
    [NIVO_API.contact.identityUnlink]: write(
        "Remove one identity from a contact.",
        z.strictObject({ contactId: uuid, identityId: uuid }),
        contact,
        "manager",
        { destructive: true, idempotent: true },
    ),
    [NIVO_API.contact.merge]: write(
        "Merge one contact into another (the older survives; cannot be undone).",
        z.strictObject({ intoContactId: uuid, fromContactId: uuid }),
        contact,
        "manager",
        { destructive: true, idempotent: true },
    ),
    [NIVO_API.contact.memoryForget]: write(
        "Forget named facts of the agents' memory of a contact.",
        z.strictObject({ contactId: uuid, facts: z.array(z.string().max(60)).min(1).max(50) }),
        answer({ forgotten: z.array(z.string().max(60)).max(50) }),
        "manager",
        { destructive: true, idempotent: true },
    ),
    [NIVO_API.contact.delete]: write(
        "Delete a contact with every record of any agent that points at it (cannot be undone).",
        z.strictObject({ id: uuid }),
        answer({ deleted: z.boolean() }),
        "owner",
        { destructive: true, idempotent: true },
    ),
    [NIVO_API.file.upload]: write(
        "Get a signed upload target (PUT) for a file into a record's file field; then PUT the bytes, then file.confirm, then file.link.",
        z.strictObject({
            ...fileTarget,
            name: z.string().min(1).max(255),
            mime: z.string().min(3).max(127),
            size: z.number().int().min(1).max(5_368_709_120),
        }),
        fileAnswer,
        "member",
        { destructive: false, idempotent: false },
    ),
    [NIVO_API.file.confirm]: write(
        "Prove an uploaded object (the store checks its size and type) and answer its reference; writes nothing to the record.",
        z.strictObject({ ...fileTarget, key: z.string().min(1).max(512), name: z.string().min(1).max(255) }),
        fileAnswer,
        "member",
        { destructive: false, idempotent: true },
    ),
    [NIVO_API.file.link]: write(
        "Attach a confirmed file to a record's file field (a single field's previous file is removed).",
        z.strictObject({ ...fileTarget, key: z.string().min(1).max(512), name: z.string().min(1).max(255) }),
        fileAnswer,
        "member",
        { destructive: true, idempotent: true },
    ),
    [NIVO_API.file.get]: read(
        "A short-lived signed URL to read a record field's file.",
        z.strictObject({ ...fileTarget, key: fileKey }),
        fileAnswer,
        "member",
        false,
    ),
    [NIVO_API.file.delete]: write(
        "Clear a record's file field (or one file of a list field) and remove the object (cannot be undone).",
        z.strictObject({ ...fileTarget, key: fileKey }),
        fileAnswer,
        "member",
        { destructive: true, idempotent: true },
    ),
    [NIVO_API.chatThread.list]: read(
        "The team /chat threads (rooms) you sit in, with their last message and unread counts (an owner sees all).",
        z.strictObject({
            kind: z.enum(["direct", "group"]).optional(),
            member: uuid.optional().describe("Only the threads this member sits in."),
        }),
        answer({ threads: rows(item) }),
        "member",
        true,
    ),
    [NIVO_API.chatThread.get]: read(
        "The messages of one team /chat thread, newest first, with each agent's stop card (run, step, state, approval); paginated.",
        z.strictObject({
            threadId: uuid,
            first: z.number().int().min(1).max(100).optional(),
            after: cursor.optional(),
            pinnedOnly: z.boolean().optional(),
        }),
        answer({ messages: rows(item, MESSAGES_PAGE_MAX), next: cursor.nullable() }),
        "member",
        true,
    ),
    [NIVO_API.brain.search]: read(
        "Search the shop's truths in force (the Second Brain) by words in their subject, attribute and value: a page of the truth graph (truths as nodes with source and validity, the links between them), paged by subject.",
        z.strictObject({
            query: z.string().max(200).optional(),
            subjectKey: z.string().max(120).optional(),
            cursor: z.string().max(120).optional(),
            limit: z.number().int().min(1).max(100).optional(),
        }),
        answer({ nodes: rows(item, BRAIN_NODES_MAX), edges: rows(item), nextCursor: cursor.nullable() }),
        "manager",
        false,
    ),
    [NIVO_API.workbench.read]: read(
        "Run a declared read of an agent's workbench (`<package>.<agent>.api.<domain>.<query>`): the module's records, as your rights reach them.",
        z.strictObject({
            name: z.string().min(1).max(120),
            vars: jsonRecordSchema.optional().describe("The read's variables (JSON object)."),
            locale: locale.optional(),
        }),
        answer({ data: jsonBodySchema }),
        "member",
        true,
    ),
    [NIVO_API.workbench.action]: write(
        "Run a declared action of an agent's workbench (`<package>.<agent>.<action>`, from record.type.list): create or change the module's records as your rights reach them (its permission and the authority rules apply; the write is stamped for the module's agent). Describe it to your user first.",
        z.strictObject({
            name: z.string().min(1).max(120).describe("The action's id, as record.type.list lists it."),
            input: jsonRecordSchema.optional().describe("The action's input (JSON object), as its input schema says."),
            locale: locale.optional(),
        }),
        answer({ result: jsonBodySchema }),
        "member",
        { destructive: true, idempotent: false },
    ),
    [NIVO_API.record.typeList]: read(
        "The record types of the workspace's installed agents (`<package>.<agent>.<domain>`, with their fields), and per agent the declared reads (workbench.read) and actions (workbench.action) that reach them, with the permission each needs and the JSON Schema of what it takes.",
        z.strictObject({}),
        answer({ modules: rows(item) }),
        "member",
        false,
    ),
    [NIVO_API.accountData.typeList]: read(
        "The declared raw data types a connected account stores (its provider's events and data as sent: bank lines, mails, channel updates).",
        z.strictObject({ connectionId: uuid.describe("The connected account.") }),
        answer({ types: rows(item) }),
        "manager",
        false,
    ),
    [NIVO_API.accountData.rowList]: read(
        "The newest raw rows of one declared data type of a connected account, newest first (at most 100).",
        z.strictObject({
            connectionId: uuid.describe("The connected account."),
            type: z.string().min(3).max(50).describe("The declared data type, as accountdata.type.list names it."),
            limit: z.number().int().min(1).max(100).optional(),
        }),
        answer({ refusal: longText.nullable(), rows: rows(item, ROWS_PAGE_MAX) }),
        "manager",
        true,
    ),
    [NIVO_API.agent.list]: read(
        "The installed agents of the workspace: installation id (for workflows and runs), agent id (for tools), name and module.",
        z.strictObject({}),
        answer({ agents: rows(item) }),
        "member",
        false,
    ),
    [NIVO_API.agent.toolList]: hidden(
        "The tools of one agent: what it may read and act on, through which accounts, and each tool's mode (the tool families the engine registers in the api app; no node tool is callable outside a graph).",
        "engine",
    ),
    [NIVO_API.agent.deletionImpact]: read(
        "What removing one installed agent would take with it: its records per record type (id, title, count), the total and the files they hold. Records die with their agent, and the channels it alone answers (a provider connection, the website, a public API key) are left with no agent; show your user these counts and channels before any removal.",
        z.strictObject({ installationId: uuid }),
        answer({
            installationId: idText,
            agentId: idText.nullable(),
            recordTypes: rows(z.looseObject({ type: idText, title: labelText, count: z.number() })),
            records: z.number(),
            files: z.number(),
            channels: rows(
                z.looseObject({
                    kind: labelText,
                    name: labelText,
                    provider: labelText.nullable(),
                    connectionId: idText.nullable(),
                }),
            ),
        }),
        "manager",
        false,
    ),
    [NIVO_API.workflow.list]: read(
        "The workflows of one installed agent, with status, version and readiness.",
        z.strictObject({ installationId: uuid, locale: locale.optional() }),
        answer({ workflows: rows(item) }),
        "manager",
        false,
    ),
    [NIVO_API.workflow.get]: read(
        "Whether you may start one workflow of an installed agent by hand (it is active, has a workflow.called trigger and is open to any caller), and the JSON Schema of its declared input for workflow.run.",
        z.strictObject({ installationId: uuid, workflowId: uuid, locale: locale.optional() }),
        answer({
            workflowId: idText,
            key: idText,
            name: labelText,
            status: labelText,
            runnable: z.boolean(),
            refusal: longText.nullable(),
            inputSchema: z.looseObject({}).nullable(),
            inputSchemaJson: schemaJson.nullable(),
        }),
        "manager",
        false,
    ),
    [NIVO_API.workflow.run]: write(
        "Start one workflow of an installed agent through its workflow.called trigger, with inputs its declared contract takes (workflow.get gives the schema); once per opKey. Answers started (queued for the engine, which starts the run; the same opKey again is the same start) or refused with why.",
        z.strictObject({
            installationId: uuid,
            workflowId: uuid,
            inputs: jsonRecordSchema.describe("The workflow's inputs, as its declared input schema says."),
        }),
        answer({
            status: z.enum(["started", "refused"]),
            refusal: longText.nullable(),
            issues: rows(item),
        }),
        "manager",
        { destructive: false, idempotent: true },
    ),
    [NIVO_API.run.list]: read(
        "The recent runs of one installed agent (running, waiting at a stop, done) and its workflows.",
        z.strictObject({ installationId: uuid }),
        answer({ runs: rows(item) }),
        "manager",
        true,
    ),
    [NIVO_API.run.get]: read(
        "One run of an installed agent: status, its steps and the decision it waits for.",
        z.strictObject({ installationId: uuid, runId: uuid, locale: locale.optional() }),
        answer({ run: item.nullable() }),
        "manager",
        true,
    ),
    [NIVO_API.run.stepDecide]: write(
        "Approve or decline the tool call an approval stop of a run waits on (its tool, account and arguments: stop.list names them). Only the workspace's owner approves; an owner or manager declines. The verdict is recorded and handed to the agent's engine, which resumes the run's thread shortly after: read run.get for its next state. Answers ok, or why not (decision_not_found, decision_closed, not_an_approver, option_not_offered with the verdicts it takes).",
        z.strictObject({
            installationId: uuid.describe("The installed agent the run belongs to."),
            runId: uuid,
            verdict: z.enum(["approve", "reject", "retry"]).describe("approve (owner only) or reject; retry is not offered on a permission request."),
            stepKey: z.string().min(1).max(200).optional().describe("The step whose approval is answered; absent: the run's newest open approval."),
            locale: locale.optional(),
        }),
        answer({
            ok: z.boolean(),
            refusal: longText.nullable(),
            accepted: z.array(labelText).max(8).optional().describe("For option_not_offered: the verdicts the waiting approval takes."),
        }),
        "manager",
        { destructive: true, idempotent: false },
    ),
    [NIVO_API.stop.list]: read(
        "The open stops of the workspace, newest first: approvals waiting for a verdict (tool, account and arguments named), AI reports with a question, frozen runs; each with what it takes (words, retry / take_over / skip, approve / refuse) and its run, workflow, agent and customer; paginated.",
        z.strictObject({
            limit: z.number().int().min(1).max(50).optional(),
            cursor: z.string().max(8).optional(),
        }),
        answer({
            stops: rows(item, STOPS_PAGE_MAX),
            total: z.number().optional().describe("How many stops stand open in the workspace; absent for an agent-scoped key."),
            next: cursor.nullable(),
        }),
        "manager",
        true,
    ),
    [NIVO_API.stop.answer]: write(
        "Answer a run's open stop as stop.list shows it: the founder's words (answer, with text), retry the step, take the conversation over, or skip (ends the run, keeping what was done). An approval stop takes its verdict through run.step.decide instead. Owner or manager. The answer is recorded and handed to the agent's engine, which resumes the run's thread shortly after: read run.get or stop.list again for its next state. Answers the outcome (admitted, already_admitted, already_answered, stop_closed, step_running, not_stopped, approval_pending with the door that takes the verdict, ...) and the step.",
        z.strictObject({
            runId: uuid,
            stepKey: z.string().min(1).max(200).optional().describe("The step whose stop is answered; absent: the run's open stop."),
            action: z.enum(["answer", "retry", "take_over", "skip"]),
            text: z.string().min(1).max(4000).optional().describe("Your user's words, for answer."),
        }),
        answer({
            outcome: labelText,
            stepKey: idText.nullable(),
            refusal: z.looseObject({}).nullable().optional().describe("For approval_pending: the stop, its item and the door that takes the verdict."),
        }),
        "manager",
        { destructive: true, idempotent: false },
    ),
    [NIVO_API.theme.get]: read(
        "The workspace's brand theme (accent hue, chroma, lightness, neutral base, font, corner step, optional mode); null while it wears the NIVO default.",
        z.strictObject({}),
        answer({ theme: themeAnswer.nullable() }),
        "member",
        false,
    ),
    [NIVO_API.theme.update]: write(
        "Save the workspace's brand theme: the six parameters, each checked by range or list. The console and the website chat wear it.",
        z.strictObject({ ...themeShape, mode: z.enum(WORKSPACE_THEME_MODES).nullable().optional() }),
        answer({ theme: themeAnswer.nullable() }),
        "manager",
        { destructive: false, idempotent: true },
    ),
    [NIVO_API.theme.reset]: write(
        "Return the workspace to the NIVO default theme.",
        z.strictObject({}),
        answer({ reset: z.boolean() }),
        "manager",
        { destructive: false, idempotent: true },
    ),
    [NIVO_API.key.list]: hidden("The workspace's API keys.", "secret"),
    [NIVO_API.key.create]: hidden("Create an API key (answers its secret once).", "secret"),
    [NIVO_API.key.rename]: hidden("Rename an API key.", "secret"),
    [NIVO_API.key.revoke]: hidden("Revoke an API key.", "secret"),
    [NIVO_API.member.roleChange]: hidden("Change a member's role.", "members"),
    [NIVO_API.member.remove]: hidden("Remove a member from the workspace.", "members"),
    [NIVO_API.workspace.delete]: hidden("Delete the workspace.", "workspace_delete"),
    [NIVO_API.connection.zaloOaSecretSave]: hidden("Save a Zalo OA connection's app secret.", "secret"),
    [NIVO_API.admin.workspacePlanSet]: hidden("Set a workspace's plan (platform admin).", "platform_admin"),
} satisfies NivoApiDeclarations

/** The declarations as the total table the catalogue reads. */
export const NIVO_API_TABLE: NivoApiDeclarations = NIVO_API_DECLARATIONS

/** The NIVO data ops declared exposed: what the executor must run, one runner each. */
export type ExposedNivoApiVerb = {
    readonly [V in keyof typeof NIVO_API_DECLARATIONS]: (typeof NIVO_API_DECLARATIONS)[V] extends { readonly exposed: true }
        ? V
        : never
}[keyof typeof NIVO_API_DECLARATIONS]

/** The arguments of one exposed op, as its declared input validator answers them. */
export type NivoApiInput<V extends ExposedNivoApiVerb> = (typeof NIVO_API_DECLARATIONS)[V] extends {
    readonly input: infer I extends z.ZodType
}
    ? z.output<I>
    : never
