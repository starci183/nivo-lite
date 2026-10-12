import type { MailNotice, MailResult } from "./module-ops.contracts"

/** The workspace mailer. It is also the injection token. */
export abstract class OutboundMail {
    /** Sends one notice through the workspace's mail connection; a delivery failure answers `failed`, it does not throw. */
    abstract send(notice: MailNotice): Promise<MailResult>
}
