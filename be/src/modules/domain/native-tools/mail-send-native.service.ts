import { Injectable, Optional } from "@nestjs/common"
import { WorkspaceMailService } from "@modules/domain/email-messages"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    NIVO_TOOL_PREFIX,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { WorkspacesService } from "@modules/domain/workspaces"
import { renderEmail } from "@modules/integrations/mail"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import { MAIL_SEND_INPUT_SCHEMA, MAIL_SEND_SCHEMA, MAIL_SUBJECT_MAX } from "./mail-send-native.schema"
import { nativeRefusal } from "./native-refusal.policy"

/** The tool inside the connector: its full name is `nivo.tool.mail.message.send` (`TOOL.mailMessageSend`). */
export const MAIL_SEND = "message.send"

/** The purpose the mail log and the mail service record. */
const PURPOSE = "agent_email"

/** The shop name a mail carries when the workspace has none. */
const DEFAULT_SHOP = "NIVO"

/** The subject as one line of at most `max` characters. */
const oneLine = (text: string, max: number): string =>
    text
        .replaceAll(/[\r\n]+/gu, " ")
        .trim()
        .slice(0, max)

/**
 * The connector of the mail a step sends through the shop's SMTP account (`nivo.tool.mail.message.send`, provider `smtp`). Its row key
 * `mail-out` is its own, its public prefix `nivo.tool.mail` shared with the mailbox reads (each with its own tools).
 */
export const MAIL_SEND_MANIFEST: ToolManifest = {
    key: "mail-out",
    namespace: `${NIVO_TOOL_PREFIX}.mail`,
    name: "Mail",
    contractVersion: "mail-send-native@2",
    tools: [
        {
            name: MAIL_SEND,
            description:
                "Sends a mail to one address through the shop's mail account. Whether a person approves it first is the calling node's mode, not this tool's.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: MAIL_SEND_INPUT_SCHEMA,
            argumentSchema: MAIL_SEND_SCHEMA,
            secretFields: ["to", "body"],
        },
    ],
}

@Injectable()
/**
 * Runs `nivo.tool.mail.message.send`: it SENDS the mail through the workspace's SMTP account and records it. It never asks: a node
 * declared `ask` is interrupted by the engine's ToolRunner BEFORE this runs (the approval card), and a node declared `auto` sends. Once
 * per step: the ToolRunner's effect ledger keeps the answer of a call a step already made, so a replay sends no second mail. A
 * workspace without its own SMTP account cannot mail (`not_connected`); an app without the mail service serves no send (`not_served`);
 * a customer named that is not the run's own is refused; a mail the server did not take is `connection_refused`.
 */
export class MailSendNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = MAIL_SEND_MANIFEST

    constructor(
        @Optional() private readonly mail?: WorkspaceMailService,
        @Optional() private readonly workspaces?: WorkspacesService,
        @Optional() @InjectMessageCatalog() private readonly catalog?: MessageCatalog,
    ) {}

    /** Sends one mail; answers the id of the recorded send and that it went out. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        if (tool !== MAIL_SEND) throw unknownTool(tool)
        const given = argumentsOf(tool, MAIL_SEND_SCHEMA, args)
        const { mail } = this
        if (mail === undefined) throw nativeRefusal("not_served")
        const runLead = caller.run?.leadId ?? null
        if (given.leadId !== undefined && runLead !== null && given.leadId !== runLead) throw nativeRefusal("other_lead")
        if (!(await mail.hasWorkspaceSmtp(workspaceId))) throw nativeRefusal("not_connected")
        const locale: Locale = caller.run?.locale ?? "vi"
        const subject = oneLine(given.subject, MAIL_SUBJECT_MAX)
        const shop = (await this.workspaces?.nameOf(workspaceId)) ?? ""
        const shopName = shop === "" ? DEFAULT_SHOP : shop
        const rendered = renderEmail({
            shopName,
            title: subject,
            body: given.body,
            footer: this.catalog?.get("performers.emailFooter", { shop: shopName }, locale) ?? "",
            lang: locale,
        })
        const sent = await mail.send({
            workspaceId,
            to: given.to,
            subject,
            html: rendered.html,
            text: rendered.text,
            purpose: PURPOSE,
            refs: {
                agent_id: caller.agentId,
                run_id: caller.run?.turnId ?? null,
                ...(given.ref === undefined ? {} : { ref_kind: given.ref.kind, ref_code: given.ref.code }),
            },
            audience: "customer",
        })
        if (sent.status === "no_smtp") throw nativeRefusal("not_connected")
        if (sent.status !== "sent") throw nativeRefusal("connection_refused")
        return { emailMessageId: sent.emailMessageId, status: sent.status }
    }
}
