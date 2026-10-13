import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MailNotice } from "@modules/domain/module-ops"
import { WorkspacesService } from "@modules/domain/workspaces"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
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
): Promise<ModuleOutboundMailService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleOutboundMailService,
            { provide: WorkspaceMailService, useValue: mock<WorkspaceMailService>({ send }) },
            { provide: WorkspacesService, useValue: mock<WorkspacesService>({ nameOf }) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn(() => "footer") }) },
            { provide: LOGGER, useValue: mock<Logger>({ error: jest.fn() }) },
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
