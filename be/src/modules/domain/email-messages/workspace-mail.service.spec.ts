import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { MAIL } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmailMessagesService } from "./email-messages.service"
import type { SendEmailInput } from "./email-messages.contracts"
import { WorkspaceMailService } from "./workspace-mail.service"

const WS = "11111111-1111-4111-8111-111111111111"
const owner: SendEmailInput = {
    workspaceId: WS,
    to: "owner@example.com",
    subject: "Daily report",
    html: "<p>Report</p>",
    text: "Report",
    purpose: "daily_report",
    audience: "owner",
}

const build = async () => {
    const log = mock<EmailMessagesService>({
        sentSince: jest.fn().mockResolvedValue(0),
        record: jest.fn().mockResolvedValue("e1"),
    })
    const mail = mock<MailClient>({ hasPlatformSender: jest.fn().mockReturnValue(false) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const connections = mock<ConnectionsService>({ listByProvider: jest.fn().mockResolvedValue([]) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceMailService,
            { provide: MAIL, useValue: mail },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: EmailMessagesService, useValue: log },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return moduleRef.get(WorkspaceMailService)
}

describe("WorkspaceMailService", () => {
    it("refuses attachments over the size one email may carry, before any sender is tried", async () => {
        const service = await build()
        const big = Buffer.alloc(2_100_000, 1).toString("base64")
        const sent = await service.send({
            ...owner,
            attachments: [{ filename: "big.bin", content: big, encoding: "base64" }],
        })
        expect(sent).toMatchObject({ status: "blocked", failure: "attachment", error: "email.err_attachment" })
    })

    it("refuses a customer email that did not pass the gate", async () => {
        const service = await build()
        await expect(service.send({ ...owner, audience: "customer" })).resolves.toMatchObject({
            status: "blocked",
            failure: "gate",
        })
    })

    it("records an owner notice as no_smtp when neither the workspace nor the platform can send", async () => {
        const service = await build()
        await expect(service.send(owner)).resolves.toMatchObject({ status: "no_smtp", failure: "no_smtp" })
    })
})
