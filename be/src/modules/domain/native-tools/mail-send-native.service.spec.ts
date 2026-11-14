import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { WorkspaceMailService } from "@modules/domain/email-messages"
import type { SendEmailResult } from "@modules/domain/email-messages"
import { ToolsErrorCode, toolNameOf } from "@modules/domain/tools"
import type { NativeCaller } from "@modules/domain/tools"
import { WorkspacesService } from "@modules/domain/workspaces"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { MAIL_SEND_MANIFEST, MailSendNativeService } from "./mail-send-native.service"

const WS = "ws-1"
const STEP: NativeCaller = {
    agentId: "agent-1",
    conversationId: null,
    graphStep: true,
    opKey: "run-1:mail:0",
    run: {
        turnId: "run-1",
        locale: "en",
        origin: "system",
        memberId: null,
        handedOffBy: null,
        leadId: "lead-1",
        stepTools: [TOOL.mailMessageSend],
    },
}
const MAIL = { to: "buyer@example.com", subject: "Your quote\nfor May", body: "Dear buyer, here is the quote.", leadId: "lead-1" }

const build = async (options: { smtp?: boolean; mail?: boolean; sent?: Partial<SendEmailResult> } = {}) => {
    const mail = mock<WorkspaceMailService>()
    mail.hasWorkspaceSmtp.mockResolvedValue(options.smtp !== false)
    mail.send.mockResolvedValue({ status: "sent", emailMessageId: "em-1", via: "workspace", ...options.sent })
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue("Hana Shop")
    const catalog = { get: jest.fn((_key: string, params: Readonly<Record<string, string>>) => `Sent by ${params.shop}.`) }
    const moduleRef = await Test.createTestingModule({
        providers: [
            MailSendNativeService,
            ...(options.mail === false ? [] : [{ provide: WorkspaceMailService, useValue: mail }]),
            { provide: WorkspacesService, useValue: workspaces },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { sender: moduleRef.get(MailSendNativeService), mail }
}

describe("MailSendNativeService: the tool", () => {
    it("publishes nivo.tool.mail.message.send, a write that is asked outside a node (the outside road's rule)", () => {
        expect(MAIL_SEND_MANIFEST.tools.map((tool) => toolNameOf(MAIL_SEND_MANIFEST, tool.name))).toEqual([TOOL.mailMessageSend])
        expect(MAIL_SEND_MANIFEST.tools[0]).toMatchObject({ scope: "write", defaultMode: "ask" })
        expect(MAIL_SEND_MANIFEST.tools[0]?.secretFields).toEqual(["to", "body"])
    })
})

/**
 * Who asks: the node's declared mode, never this tool. `ask` interrupts in the ToolRunner BEFORE the native is called (the approval card,
 * then a replay of the approved call): `tools/node-tool-door.node-mode.spec.ts` ("`ask`: ... asks ONCE, and runs after the person's yes")
 * and `tools/tool-runner.service.spec.ts` ("files an ask as an approval line and throws it as it was"). Once per step on a replay: the same
 * runner's effect ledger (`tool-runner.service.spec.ts`, "runs an effect once per key"). What stays here: on `auto` the native SENDS.
 */
describe("MailSendNativeService: sends (the node is `auto`)", () => {
    it("sends the mail through the workspace's mail account, to a customer, in the shop's layout, and answers the recorded send", async () => {
        const { sender, mail } = await build()

        await expect(sender.invoke(WS, "message.send", MAIL, STEP)).resolves.toEqual({ emailMessageId: "em-1", status: "sent" })

        expect(mail.send).toHaveBeenCalledTimes(1)
        expect(mail.send).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: WS,
                to: "buyer@example.com",
                subject: "Your quote for May",
                purpose: "agent_email",
                audience: "customer",
                refs: { agent_id: "agent-1", run_id: "run-1" },
            }),
        )
        const [sent] = mail.send.mock.calls[0] ?? []
        expect(sent?.text).toContain("Dear buyer, here is the quote.")
        expect(sent?.text).toContain("Hana Shop")
        expect(sent?.html).toContain("Dear buyer, here is the quote.")
    })

    it("carries the business record the mail is about onto the send's references", async () => {
        const { sender, mail } = await build()

        await sender.invoke(WS, "message.send", { ...MAIL, ref: { kind: "invoice", code: "INV-7" } }, STEP)

        expect(mail.send.mock.calls[0]?.[0].refs).toEqual({ agent_id: "agent-1", run_id: "run-1", ref_kind: "invoice", ref_code: "INV-7" })
        await expect(sender.invoke(WS, "message.send", { ...MAIL, ref: { kind: "invoice" } }, STEP)).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
    })

    it("refuses a workspace with no SMTP account, another customer than the run's, and a bad address, sending nothing", async () => {
        const { sender: noSmtp, mail: none } = await build({ smtp: false })
        await expect(noSmtp.invoke(WS, "message.send", MAIL, STEP)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
        const { sender, mail } = await build()
        await expect(sender.invoke(WS, "message.send", { ...MAIL, leadId: "lead-9" }, STEP)).rejects.toMatchObject({
            params: { reason: "other_lead" },
        })
        await expect(sender.invoke(WS, "message.send", { ...MAIL, to: "not an address" }, STEP)).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
        expect(none.send).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
    })

    it("refuses a mail the server did not take (`connection_refused`), and one the account cannot send (`not_connected`)", async () => {
        const failed = await build({ sent: { status: "failed", failure: "mail", error: "refused" } })
        const limited = await build({ sent: { status: "rate_limited", failure: "rate" } })
        const gone = await build({ sent: { status: "no_smtp", failure: "no_smtp" } })

        await expect(failed.sender.invoke(WS, "message.send", MAIL, STEP)).rejects.toMatchObject({ params: { reason: "connection_refused" } })
        await expect(limited.sender.invoke(WS, "message.send", MAIL, STEP)).rejects.toMatchObject({ params: { reason: "connection_refused" } })
        await expect(gone.sender.invoke(WS, "message.send", MAIL, STEP)).rejects.toMatchObject({ params: { reason: "not_connected" } })
    })

    it("is not served in an app without the mail service, and knows no other tool", async () => {
        const { sender } = await build({ mail: false })
        await expect(sender.invoke(WS, "message.send", MAIL, STEP)).rejects.toMatchObject({ params: { reason: "not_served" } })
        await expect(sender.invoke(WS, "message.delete", MAIL, STEP)).rejects.toMatchObject({ code: ToolsErrorCode.UnknownTool })
    })
})
