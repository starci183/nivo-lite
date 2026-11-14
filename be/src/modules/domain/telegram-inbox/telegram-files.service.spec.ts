import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionSecretsErrorCode } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import type { TelegramMessageFile as TelegramAttachment } from "./telegram-message.trigger"
import { TELEGRAM, TelegramError, TelegramErrorCode } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TELEGRAM_DOWNLOAD_MAX_BYTES, TelegramFilesService } from "./telegram-files.service"
import { TelegramInboxLogEvent } from "./telegram-inbox.log-events"

const TOKEN = "123456:bot-token"

const photo = (patch: Partial<TelegramAttachment> = {}): TelegramAttachment => ({
    kind: "image",
    fileId: "file-1",
    name: "",
    size: 90_000,
    ...patch,
})

const build = async (opened = true) => {
    const secrets = mock<ConnectionSecretReadsService>()
    secrets.secretOf.mockResolvedValue(
        opened
            ? {
                  kind: "ok",
                  value: { workspaceId: "ws-1", credential: TOKEN, webhookSecret: "hook", tokenExpiresAt: null },
              }
            : { kind: "refused", code: ConnectionSecretsErrorCode.NotFound },
    )
    const telegram = mock<TelegramClient>()
    telegram.fileUrl.mockImplementation((token, fileId) =>
        Promise.resolve(`https://telegram.test/file/bot${token}/photos/${fileId}.jpg`),
    )
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramFilesService,
            { provide: ConnectionSecretReadsService, useValue: secrets },
            { provide: TELEGRAM, useValue: telegram },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(TelegramFilesService), secrets, telegram, logger }
}

describe("TelegramFilesService", () => {
    it("asks the bot of the connection for each file and answers the addresses in order", async () => {
        const { service, secrets, telegram } = await build()

        await expect(
            service.addressesOf("c-1", [photo(), photo({ kind: "file", fileId: "file-2", name: "don.pdf", size: null })]),
        ).resolves.toEqual([
            { kind: "image", url: `https://telegram.test/file/bot${TOKEN}/photos/file-1.jpg`, name: "" },
            { kind: "file", url: `https://telegram.test/file/bot${TOKEN}/photos/file-2.jpg`, name: "don.pdf" },
        ])
        expect(secrets.secretOf).toHaveBeenCalledWith("c-1", "telegram")
        expect(telegram.fileUrl).toHaveBeenCalledTimes(2)
    })

    it("opens no secret for a text message", async () => {
        const { service, secrets } = await build()

        await expect(service.addressesOf("c-1", [])).resolves.toEqual([])
        expect(secrets.secretOf).not.toHaveBeenCalled()
    })

    it("leaves every file without an address when the bot of the connection cannot be opened", async () => {
        const { service, telegram, logger } = await build(false)

        await expect(service.addressesOf("c-1", [photo()])).resolves.toEqual([{ kind: "image", url: "", name: "" }])
        expect(telegram.fileUrl).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(TelegramInboxLogEvent.FileNotAddressed, {
            connectionId: "c-1",
            reason: "no_bot",
        })
    })

    it("does not ask for a file larger than a bot may download", async () => {
        const { service, telegram } = await build()

        await expect(service.addressesOf("c-1", [photo({ size: TELEGRAM_DOWNLOAD_MAX_BYTES + 1 })])).resolves.toEqual([
            { kind: "image", url: "", name: "" },
        ])
        expect(telegram.fileUrl).not.toHaveBeenCalled()
    })

    it("keeps the other files when Telegram refuses one, and never logs the address or the token", async () => {
        const { service, telegram, logger } = await build()
        telegram.fileUrl.mockRejectedValueOnce(
            new TelegramError({ code: TelegramErrorCode.Rejected, params: { method: "getFile", reason: "file is too big" } }),
        )

        const addresses = await service.addressesOf("c-1", [photo(), photo({ fileId: "file-2" })])

        expect(addresses.map((address) => address.url === "")).toEqual([true, false])
        expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(TOKEN)
    })

    it("leaves a file without an address when Telegram gives no file_path", async () => {
        const { service, telegram } = await build()
        telegram.fileUrl.mockResolvedValue("")

        await expect(service.addressesOf("c-1", [photo()])).resolves.toEqual([{ kind: "image", url: "", name: "" }])
    })
})
