import { Injectable } from "@nestjs/common"
import { OutboundMail } from "@modules/domain/module-ops"
import { CandidateChat } from "./candidate-chat.port"
import type { CandidateRecord, Delivery } from "./hiring.contracts"
import { HiringTextService } from "./hiring-text.service"

/** What is sent to a candidate. */
export interface CandidateMessage {
    /** The subject of the email. */
    readonly subject: string
    /** The text, the same in the chat and in the email. */
    readonly text: string
    /** The decision the gate let through; customer mail is refused without one. */
    readonly workItemId: string
}

@Injectable()
/** Talking to a candidate: into the chat conversation they applied through and by email when they gave one. It never throws; the result says what happened. */
export class HiringNotifyService {
    constructor(
        private readonly chat: CandidateChat,
        private readonly mail: OutboundMail,
        private readonly words: HiringTextService,
    ) {}

    /** Sends one message to a candidate by every way open to it. */
    async toCandidate(candidate: CandidateRecord, message: CandidateMessage): Promise<Delivery> {
        const chat =
            candidate.conversationId === null
                ? null
                : await this.chat.deliver(candidate.workspaceId, candidate.conversationId, message.text)
        const mail =
            candidate.email === ""
                ? null
                : await this.mail.send({
                      workspaceId: candidate.workspaceId,
                      to: candidate.email,
                      subject: message.subject,
                      title: message.subject,
                      body: message.text,
                      purpose: "hiring",
                      audience: "customer",
                      refs: { candidate_id: candidate.id },
                      workItemId: message.workItemId,
                  })
        const mailSent = mail?.status === "sent"
        if (chat === true) {
            return {
                via: "chat",
                delivered: true,
                note: this.words.text(mailSent ? "hiring.delivery.chatEmail" : "hiring.delivery.chat"),
            }
        }
        if (mailSent) return { via: "email", delivered: true, note: this.words.text("hiring.delivery.email") }
        const why = [
            chat === false ? this.words.text("hiring.delivery.chatFailed") : "",
            mail?.error ?? (mail === null ? "" : this.words.text("hiring.delivery.mailFailed")),
        ]
            .filter((part) => part !== "")
            .join("; ")
        return {
            via: "manual",
            delivered: false,
            note: this.words.text("hiring.delivery.manual", { why: why === "" ? "" : ` (${why})` }),
        }
    }
}
