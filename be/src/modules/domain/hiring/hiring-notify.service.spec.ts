import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { OutboundMail } from "@modules/domain/module-ops"
import type { MessageCatalog } from "@modules/platform/i18n"
import { CandidateChat } from "./candidate-chat.port"
import type { CandidateRecord } from "./hiring.contracts"
import { HiringNotifyService } from "./hiring-notify.service"
import { HiringTextService } from "./hiring-text.service"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const candidateOf = builder<CandidateRecord>({
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alex",
    phone: "0901234567",
    email: "alex@example.test",
    source: "chat",
    conversationId: "conversation-1",
    cvPath: null,
    cvName: null,
    cvMime: null,
    answers: [],
    availability: "Weekdays",
    stage: "applied",
    staffId: null,
})

const message = { subject: "Interview invitation", text: "Please choose a time", workItemId: "work-1" }

const build = async () => {
    const chat = mock<CandidateChat>()
    chat.deliver.mockResolvedValue(false)
    const mail = mock<OutboundMail>()
    mail.send.mockResolvedValue({ status: "failed" })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<HiringTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    const moduleRef = await Test.createTestingModule({
        providers: [
            HiringNotifyService,
            { provide: CandidateChat, useValue: chat },
            { provide: OutboundMail, useValue: mail },
            { provide: HiringTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(HiringNotifyService), chat, mail, words }
}

describe("HiringNotifyService", () => {
    it("delivers through both available channels and reports chat with email", async () => {
        const { service, chat, mail, words } = await build()
        chat.deliver.mockResolvedValue(true)
        mail.send.mockResolvedValue({ status: "sent" })

        await expect(service.toCandidate(candidateOf(), message)).resolves.toEqual({
            via: "chat",
            delivered: true,
            note: "hiring.delivery.chatEmail{}",
        })

        expect(chat.deliver).toHaveBeenCalledTimes(1)
        expect(chat.deliver).toHaveBeenCalledWith("ws-1", "conversation-1", "Please choose a time")
        expect(mail.send).toHaveBeenCalledTimes(1)
        expect(mail.send).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            to: "alex@example.test",
            subject: "Interview invitation",
            title: "Interview invitation",
            body: "Please choose a time",
            purpose: "hiring",
            audience: "customer",
            refs: { candidate_id: "candidate-1" },
            workItemId: "work-1",
        })
        expect(words.text.mock.calls).toEqual([["hiring.delivery.chatEmail"]])
    })

    it("reports chat delivery when email fails", async () => {
        const { service, chat, mail, words } = await build()
        chat.deliver.mockResolvedValue(true)
        mail.send.mockResolvedValue({ status: "failed", error: "mail-offline" })

        await expect(service.toCandidate(candidateOf(), message)).resolves.toEqual({
            via: "chat",
            delivered: true,
            note: "hiring.delivery.chat{}",
        })

        expect(mail.send).toHaveBeenCalledTimes(1)
        expect(words.text.mock.calls).toEqual([["hiring.delivery.chat"]])
    })

    it("reports chat delivery without attempting mail when no email was given", async () => {
        const { service, chat, mail } = await build()
        chat.deliver.mockResolvedValue(true)

        await expect(service.toCandidate(candidateOf({ email: "" }), message)).resolves.toEqual({
            via: "chat",
            delivered: true,
            note: "hiring.delivery.chat{}",
        })

        expect(chat.deliver).toHaveBeenCalledWith("ws-1", "conversation-1", message.text)
        expect(mail.send).not.toHaveBeenCalled()
    })
})

describe("HiringNotifyService", () => {
    it("reports email delivery after the chat failed", async () => {
        const { service, chat, mail, words } = await build()
        mail.send.mockResolvedValue({ status: "sent" })

        await expect(service.toCandidate(candidateOf(), message)).resolves.toEqual({
            via: "email",
            delivered: true,
            note: "hiring.delivery.email{}",
        })

        expect(chat.deliver).toHaveBeenCalledTimes(1)
        expect(words.text.mock.calls).toEqual([["hiring.delivery.email"]])
    })

    it("reports email delivery without attempting chat when there is no conversation", async () => {
        const { service, chat, mail } = await build()
        mail.send.mockResolvedValue({ status: "sent" })

        await expect(service.toCandidate(candidateOf({ conversationId: null }), message)).resolves.toEqual({
            via: "email",
            delivered: true,
            note: "hiring.delivery.email{}",
        })

        expect(chat.deliver).not.toHaveBeenCalled()
        expect(mail.send).toHaveBeenCalledTimes(1)
    })

    it("includes the chat failure and the mail error when neither channel delivered", async () => {
        const { service, mail, words } = await build()
        mail.send.mockResolvedValue({ status: "failed", error: "mail-offline" })

        await expect(service.toCandidate(candidateOf(), message)).resolves.toEqual({
            via: "manual",
            delivered: false,
            note: `hiring.delivery.manual{"why":" (hiring.delivery.chatFailed{}; mail-offline)"}`,
        })

        expect(words.text.mock.calls).toEqual([
            ["hiring.delivery.chatFailed"],
            ["hiring.delivery.manual", { why: " (hiring.delivery.chatFailed{}; mail-offline)" }],
        ])
    })

    it("uses the catalog mail failure when the mailer did not give an error", async () => {
        const { service, words } = await build()

        await expect(service.toCandidate(candidateOf(), message)).resolves.toEqual({
            via: "manual",
            delivered: false,
            note: `hiring.delivery.manual{"why":" (hiring.delivery.chatFailed{}; hiring.delivery.mailFailed{})"}`,
        })

        expect(words.text.mock.calls).toEqual([
            ["hiring.delivery.chatFailed"],
            ["hiring.delivery.mailFailed"],
            ["hiring.delivery.manual", { why: " (hiring.delivery.chatFailed{}; hiring.delivery.mailFailed{})" }],
        ])
    })
})

describe("HiringNotifyService", () => {
    it("includes only the mail failure when no chat conversation exists", async () => {
        const { service, chat, words } = await build()

        await expect(service.toCandidate(candidateOf({ conversationId: null }), message)).resolves.toEqual({
            via: "manual",
            delivered: false,
            note: `hiring.delivery.manual{"why":" (hiring.delivery.mailFailed{})"}`,
        })

        expect(chat.deliver).not.toHaveBeenCalled()
        expect(words.text.mock.calls).toEqual([
            ["hiring.delivery.mailFailed"],
            ["hiring.delivery.manual", { why: " (hiring.delivery.mailFailed{})" }],
        ])
    })

    it("includes only the chat failure when no email exists", async () => {
        const { service, mail } = await build()

        await expect(service.toCandidate(candidateOf({ email: "" }), message)).resolves.toEqual({
            via: "manual",
            delivered: false,
            note: `hiring.delivery.manual{"why":" (hiring.delivery.chatFailed{})"}`,
        })

        expect(mail.send).not.toHaveBeenCalled()
    })

    it("reports manual follow-up without a failure reason when neither channel exists", async () => {
        const { service, chat, mail, words } = await build()

        await expect(service.toCandidate(candidateOf({ conversationId: null, email: "" }), message)).resolves.toEqual({
            via: "manual",
            delivered: false,
            note: `hiring.delivery.manual{"why":""}`,
        })

        expect(chat.deliver).not.toHaveBeenCalled()
        expect(mail.send).not.toHaveBeenCalled()
        expect(words.text.mock.calls).toEqual([["hiring.delivery.manual", { why: "" }]])
    })

    it("preserves an empty mail error and filters it out of the failure reason", async () => {
        const { service, mail, words } = await build()
        mail.send.mockResolvedValue({ status: "failed", error: "" })

        await expect(service.toCandidate(candidateOf({ conversationId: null }), message)).resolves.toEqual({
            via: "manual",
            delivered: false,
            note: `hiring.delivery.manual{"why":""}`,
        })

        expect(words.text.mock.calls).toEqual([["hiring.delivery.manual", { why: "" }]])
    })
})
