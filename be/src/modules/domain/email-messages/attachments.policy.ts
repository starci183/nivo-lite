import type { MailAttachment } from "@modules/integrations/mail"
import type { EmailAttachment } from "./email-messages.contracts"

/** How many files one email carries at most; any more are dropped. */
const MAX_ATTACHMENTS = 3
/** How many bytes the files of one email may take together. */
export const MAX_ATTACHMENT_BYTES = 2_000_000
const FILENAME_MAX = 80

/** The files in the shape the mail integration sends, at most three, with names a mail client reads safely. */
export const mailAttachmentsOf = (list: ReadonlyArray<EmailAttachment>): ReadonlyArray<MailAttachment> =>
    list.slice(0, MAX_ATTACHMENTS).map((attachment) => ({
        filename: attachment.filename.replace(/[^\w.\- ]+/gu, "_").slice(0, FILENAME_MAX) || "attachment",
        content: Buffer.from(attachment.content, attachment.encoding === "base64" ? "base64" : "utf8"),
        contentType: attachment.contentType,
    }))

/** True when the files together are within the size one email may carry. */
export const fitsAttachmentLimit = (files: ReadonlyArray<MailAttachment>): boolean =>
    files.reduce((total, file) => total + file.content.length, 0) <= MAX_ATTACHMENT_BYTES
