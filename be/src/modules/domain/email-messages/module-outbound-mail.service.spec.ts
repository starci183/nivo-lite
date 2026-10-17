import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MailNotice } from "@modules/domain/module-ops"
import { WorkspacesService } from "@modules/domain/workspaces"
import { renderEmail } from "@modules/integrations/mail"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmailMessagesLogEvent } from "./email-messages.log-events"
import { ModuleOutboundMailService } from "./module-outbound-mail.service"
import { WorkspaceMailService } from "./workspace-mail.service"

const notice: MailNotice = {
    workspaceId: "w1",
    to: "owner@shop.vn",
    subject: "Shifts",
    title: "Week shifts",
    body: "Hello",
    purpose: "shifts_schedule",
    audience: "owner",
    refs: { schedule_id: "s1" },
}

const setup = async (
    send: jest.Mock,
    nameOf: jest.Mock = jest.fn().mockResolvedValue("Shop A"),
    error: jest.Mock = jest.fn(),
    get: jest.Mock = jest.fn(() => "footer"),
): Promise<ModuleOutboundMailService> => {
    const mail = mock<WorkspaceMailService>({ send })
    const workspaces = mock<WorkspacesService>({ nameOf })
    const catalog = mock<MessageCatalog>({ get })
    const logger = mock<Logger>({ error })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleOutboundMailService,
            { provide: WorkspaceMailService, useValue: mail },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return moduleRef.get(ModuleOutboundMailService)
}

describe("ModuleOutboundMailService", () => {
    it("sends the rendered notice through the workspace mail path", async () => {
        const send = jest.fn().mockResolvedValue({ status: "sent", via: "workspace", emailMessageId: "e1" })
        const subject = await setup(send)

        await expect(subject.send(notice)).resolves.toEqual({ status: "sent" })

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: "w1",
                to: "owner@shop.vn",
                subject: "Shifts",
                purpose: "shifts_schedule",
                audience: "owner",
                refs: { schedule_id: "s1" },
                html: expect.stringContaining("Shop A"),
            }),
        )
    })

    it("answers failed with the refusal code", async () => {
        const send = jest.fn().mockResolvedValue({ status: "no_smtp", via: "none", failure: "no_smtp" })
        const subject = await setup(send)

        await expect(subject.send(notice)).resolves.toEqual({ status: "failed", error: "no_smtp" })
    })

    it("answers failed instead of throwing", async () => {
        const subject = await setup(jest.fn(), jest.fn().mockRejectedValue(new Error("db")))

        await expect(subject.send(notice)).resolves.toEqual({ status: "failed", error: "error" })
    })

    it("passes the notice's files on to the workspace mail path", async () => {
        const send = jest.fn().mockResolvedValue({ status: "sent", via: "workspace", emailMessageId: "e1" })
        const subject = await setup(send)
        const file = { filename: "shifts-2026-10.csv", content: "staff,hours", contentType: "text/csv" }

        await expect(subject.send({ ...notice, attachments: [file] })).resolves.toEqual({ status: "sent" })

        expect(send).toHaveBeenCalledWith(expect.objectContaining({ attachments: [file] }))
    })

    it("sends no files when the notice has none", async () => {
        const send = jest.fn().mockResolvedValue({ status: "sent", via: "workspace", emailMessageId: "e1" })
        const subject = await setup(send)

        await subject.send(notice)

        expect(send).toHaveBeenCalledWith(expect.not.objectContaining({ attachments: expect.anything() }))
    })
})

describe("ModuleOutboundMailService", () => {
    it("renders the default shop, supplies empty references and forwards the approved work item", async () => {
        const send = jest.fn().mockResolvedValue({ status: "sent" })
        const nameOf = jest.fn().mockResolvedValue("")
        const get = jest.fn().mockReturnValue("NIVO footer")
        const subject = await setup(send, nameOf, jest.fn(), get)
        const rendered = renderEmail({
            shopName: "NIVO",
            title: notice.title,
            body: notice.body,
            footer: "NIVO footer",
            lang: "vi",
        })

        await expect(subject.send({ ...notice, refs: undefined, workItemId: "work-1" })).resolves.toEqual({
            status: "sent",
        })

        expect(nameOf).toHaveBeenCalledWith("w1")
        expect(get).toHaveBeenCalledWith("email.notice_footer", { shop: "NIVO" }, "vi")
        expect(send).toHaveBeenCalledWith({
            workspaceId: "w1",
            to: "owner@shop.vn",
            subject: "Shifts",
            html: rendered.html,
            text: rendered.text,
            purpose: "shifts_schedule",
            refs: {},
            audience: "owner",
            workItemId: "work-1",
        })
    })

    it("uses the delivery status when the mail path has no failure code", async () => {
        const subject = await setup(jest.fn().mockResolvedValue({ status: "blocked" }))

        await expect(subject.send(notice)).resolves.toEqual({ status: "failed", error: "blocked" })
    })

    it("logs the purpose and original cause when sending fails unexpectedly", async () => {
        const cause = new Error("record failed")
        const error = jest.fn()
        const subject = await setup(jest.fn().mockRejectedValue(cause), jest.fn().mockResolvedValue("Shop"), error)

        await expect(subject.send(notice)).resolves.toEqual({ status: "failed", error: "error" })
        expect(error).toHaveBeenCalledWith(EmailMessagesLogEvent.NoticeFailed, cause, { purpose: "shifts_schedule" })
    })
})
