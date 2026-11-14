import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { TelegramErrorCode } from "./errors/telegram.error"
import { TelegramClient } from "./telegram.client"
import { TELEGRAM_OPTIONS } from "./telegram.decorators"
import type { TelegramOptions } from "./telegram.options"

const options: TelegramOptions = { apiBase: "https://telegram.test", timeoutMs: 4000 }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: TELEGRAM_OPTIONS, useValue: options },
        ],
    }).compile()
    return { client: moduleRef.get(TelegramClient), http }
}

describe("TelegramClient fileUrl", () => {
    it("asks getFile for the file id and answers the download address under the bot of the token", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({
            status: 200,
            body: { ok: true, result: { file_id: "f-1", file_unique_id: "u-1", file_path: "photos/file_3.jpg" } },
        })

        await expect(client.fileUrl("123:abc", "f-1")).resolves.toBe(
            "https://telegram.test/file/bot123:abc/photos/file_3.jpg",
        )
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: "https://telegram.test/bot123:abc/getFile",
            body: { file_id: "f-1" },
            timeoutMs: 4000,
        })
    })

    it("answers an empty text when Telegram gives no file_path", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ok: true, result: { file_id: "f-1", file_unique_id: "u-1" } } })

        await expect(client.fileUrl("123:abc", "f-1")).resolves.toBe("")
    })

    it("rejects as the call does when Telegram refuses the file", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 400, body: { ok: false, description: "Bad Request: file is too big" } })

        await expect(client.fileUrl("123:abc", "f-1")).rejects.toMatchObject({ code: TelegramErrorCode.Rejected })
    })
})

describe("TelegramClient call", () => {
    it("posts the method to the bot of the token and returns the result", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ok: true, result: { id: 7 } } })

        await expect(client.call("123:abc", "getMe", { a: 1 })).resolves.toEqual({ id: 7 })

        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: "https://telegram.test/bot123:abc/getMe",
            body: { a: 1 },
            timeoutMs: 4000,
        })
    })

    it("sends an empty body when none is given", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ok: true } })

        await client.call("123:abc", "getMe")

        expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ body: {} }))
    })

    it("reports the description Telegram gave when it refuses the call", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 401, body: { ok: false, description: "Unauthorized" } })

        await expect(client.call("123:abc", "getMe")).rejects.toMatchObject({
            code: TelegramErrorCode.Rejected,
            params: { method: "getMe", reason: "Unauthorized" },
        })
    })

    it("falls back to the status when the answer has no readable description", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 502, body: undefined })

        await expect(client.call("123:abc", "getMe")).rejects.toMatchObject({
            code: TelegramErrorCode.Unavailable,
            params: { method: "getMe", reason: "502" },
        })
    })

    it("maps a transport failure to unavailable and keeps the cause", async () => {
        const { client, http } = await build()
        const failure = new Error("socket hang up")
        http.request.mockRejectedValue(failure)

        await expect(client.call("123:abc", "getMe")).rejects.toMatchObject({
            code: TelegramErrorCode.Unavailable,
            cause: failure,
        })
    })
})

describe("TelegramClient sendMessage", () => {
    it("sends the text to the chat", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ok: true, result: {} } })

        await client.sendMessage("123:abc", "42", "Hello")

        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "https://telegram.test/bot123:abc/sendMessage",
                body: { chat_id: "42", text: "Hello" },
            }),
        )
    })
})

describe("TelegramClient sendTyping", () => {
    it("shows the typing action and reports success", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ok: true, result: true } })

        await expect(client.sendTyping("123:abc", "42")).resolves.toBe(true)

        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({ body: { chat_id: "42", action: "typing" } }),
        )
    })

    it("never fails the reply when Telegram refuses the action", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new Error("down"))

        await expect(client.sendTyping("123:abc", "42")).resolves.toBe(false)
    })
})

describe("TelegramClient pictures", () => {
    it("sends one photo by address with its caption", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ok: true, result: {} } })

        await client.sendPhoto("123:abc", "555", "https://api/1.jpg", "Basket\n2.000 VND")

        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "https://telegram.test/bot123:abc/sendPhoto",
                body: { chat_id: "555", photo: "https://api/1.jpg", caption: "Basket\n2.000 VND" },
            }),
        )
    })

    it("sends an album with sendMediaGroup, a caption on each photo, and leaves out an empty caption", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { ok: true, result: [] } })

        await client.sendMediaGroup("123:abc", "555", [
            { url: "https://api/1.jpg", caption: "Basket" },
            { url: "https://api/2.jpg", caption: "" },
        ])

        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "https://telegram.test/bot123:abc/sendMediaGroup",
                body: {
                    chat_id: "555",
                    media: [
                        { type: "photo", media: "https://api/1.jpg", caption: "Basket" },
                        { type: "photo", media: "https://api/2.jpg" },
                    ],
                },
            }),
        )
    })
})
