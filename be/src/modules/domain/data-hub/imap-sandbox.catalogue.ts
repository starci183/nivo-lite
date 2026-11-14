import type { DataRecordInput } from "@modules/domain/data-records"
import type { SandboxCase, SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** The provider key of a mailbox account. */
export const IMAP_SANDBOX_PROVIDER = "imap"

/** The operation of the mailbox pull in the sandbox call log and in the account's next-case selector. */
export const IMAP_PULL_OPERATION = "pull"

/** The sandbox state name that keeps which sets the account was already handed (key: the set's case id). */
export const IMAP_SANDBOX_DELIVERED_STATE = "imap-delivered"

/** The sandbox state name that keeps the last UID the account handed out (key: the folder). */
export const IMAP_SANDBOX_UID_STATE = "imap-uid"

/** The only folder of a sandbox mailbox. */
export const IMAP_SANDBOX_FOLDER = "INBOX"

/** The UIDVALIDITY of the sandbox mailbox (fixed: the sandbox mailbox is never rebuilt). */
export const IMAP_SANDBOX_UID_VALIDITY = "1"

/** The mailbox the mails are addressed to. */
const MAILBOX = { name: "Cua hang", address: "shop@example.com" }

/** The domain the sandbox message ids live under. */
const MESSAGE_ID_DOMAIN = "sandbox.nivo"

/** One minute, the gap between two mails of a set. */
const MINUTE_MS = 60_000

/** One mail of a set, as the sender wrote it (the UID, the date and the message id are the account's and the pull's). */
interface SandboxMail {
    readonly fromName: string
    readonly fromAddress: string
    readonly subject: string
    readonly text: string
    /** The `Message-ID` of the mail this one answers (a renewal notice NIVO sent), or null. */
    readonly inReplyTo: string | null
}

/** The notice a renewal reply answers (a fixed id: the sandbox keeps no sent mail). */
const RENEWAL_NOTICE = `<renewal-notice-1@${MESSAGE_ID_DOMAIN}>`

/** The size of the burst of IMAP-7: one customer asking after an order each, in a fixed order. */
const BURST_SIZE = 30

const burstOf = (): ReadonlyArray<SandboxMail> =>
    Array.from({ length: BURST_SIZE }, (_, index) => ({
        fromName: `Khach ${index + 1}`,
        fromAddress: `khach${index + 1}@example.com`,
        subject: `Hoi don hang so ${index + 1}`,
        text: `Chao shop, don hang so ${index + 1} cua minh bao gio giao a?`,
        inReplyTo: null,
    }))

/** The mails of each named set, by case id: fixed, identical on every machine. */
const SETS: Readonly<Record<string, ReadonlyArray<SandboxMail>>> = {
    "IMAP-1": [
        {
            fromName: "Nguyen Van An",
            fromAddress: "an.nguyen@example.com",
            subject: "Website bi loi khi thanh toan",
            text: "Chao shop, minh bam thanh toan tren website thi bao loi va khong len don. Nho shop kiem tra giup minh.",
            inReplyTo: null,
        },
    ],
    "IMAP-2": [
        {
            fromName: "Tran Thi Binh",
            fromAddress: "binh.tran@example.com",
            subject: "Hoi gia goi dich vu",
            text: "Chao shop, ben minh co cac goi dich vu nao va gia bao nhieu a? Minh can goi cho mot cua hang nho.",
            inReplyTo: null,
        },
    ],
    "IMAP-3": [
        {
            fromName: "Le Van Cuong",
            fromAddress: "cuong.le@example.com",
            subject: "Re: Gia han ten mien shop-cua-cuong.vn",
            text: "Dong y, gia han giup minh.",
            inReplyTo: RENEWAL_NOTICE,
        },
    ],
    "IMAP-4": [
        {
            fromName: "Pham Thi Dung",
            fromAddress: "dung.pham@example.com",
            subject: "Re: Gia han ten mien shop-cua-dung.vn",
            text: "Khong, minh khong gia han nua. Cam on.",
            inReplyTo: RENEWAL_NOTICE,
        },
    ],
    "IMAP-5": [
        {
            fromName: "",
            fromAddress: "nguoi.la@khong-ro.example.net",
            subject: "Hop tac quang cao",
            text: "Chao ban, ben toi muon de nghi hop tac quang cao. Ban vui long goi lai so 0900 000 000.",
            inReplyTo: null,
        },
    ],
    "IMAP-6": [
        {
            fromName: "Hoang Van Em",
            fromAddress: "em.hoang@example.com",
            subject: "Re: Gia han ten mien shop-cua-em.vn",
            text: "Dong y gia han ten mien. Nhung cho minh hoi them: phi hosting nam nay co tang khong, va bao gio xuat hoa don?",
            inReplyTo: RENEWAL_NOTICE,
        },
    ],
    "IMAP-7": burstOf(),
}

/** The default set: answered while the account's selector names nothing. */
export const IMAP_SANDBOX_DEFAULT_SET = "IMAP-1"

/** The set a pull answers: the account's next case when it names a set, else the default (the first). */
export const imapSetIdOf = (nextCase: string | null): string =>
    nextCase !== null && Object.hasOwn(SETS, nextCase) ? nextCase : IMAP_SANDBOX_DEFAULT_SET

/**
 * The hub rows of one set as the live client delivers them (`externalId` `<folder>:<uidvalidity>:<uid>`, the subject as title, the
 * sender's date, `data` with folder, uid, from, to, cc, subject, text, attachments, messageId, inReplyTo). The UIDs run from `firstUid`;
 * the dates are derived from `at` (the pull's moment: the last mail of the set is `at`, each earlier one a minute before).
 */
export const imapRowsOf = (setId: string, firstUid: number, at: Date): ReadonlyArray<DataRecordInput> => {
    const mails = SETS[setId] ?? []
    return mails.map((mail, index) => {
        const uid = firstUid + index
        return {
            externalId: `${IMAP_SANDBOX_FOLDER}:${IMAP_SANDBOX_UID_VALIDITY}:${uid}`,
            title: mail.subject,
            occurredAt: new Date(at.getTime() - (mails.length - 1 - index) * MINUTE_MS),
            data: {
                folder: IMAP_SANDBOX_FOLDER,
                uid,
                from: [{ name: mail.fromName === "" ? null : mail.fromName, address: mail.fromAddress }],
                to: [MAILBOX],
                cc: [],
                subject: mail.subject,
                text: mail.text,
                truncated: false,
                attachments: [],
                messageId: `<sbx-imap-${uid}@${MESSAGE_ID_DOMAIN}>`,
                inReplyTo: mail.inReplyTo,
            },
        }
    })
}

/** The outbound cases of the mailbox pull: the account's NEXT CASE picks the set the next poll delivers; IMAP-1 answers while nothing is picked. */
export const IMAP_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    { id: "IMAP-1", label: "A support request: one customer reports the checkout failing", operation: IMAP_PULL_OPERATION, default: true },
    { id: "IMAP-2", label: "An enquiry: one prospect asks the price of the plans", operation: IMAP_PULL_OPERATION },
    { id: "IMAP-3", label: "A renewal reply yes: a customer agrees to renew the domain, answering a renewal notice", operation: IMAP_PULL_OPERATION },
    { id: "IMAP-4", label: "A renewal reply no: a customer declines to renew the domain, answering a renewal notice", operation: IMAP_PULL_OPERATION },
    { id: "IMAP-5", label: "An unknown sender: a stranger's mail that matches no customer", operation: IMAP_PULL_OPERATION },
    { id: "IMAP-6", label: "A mail meaning two things: agrees to renew and asks about hosting fees and invoicing in the same mail", operation: IMAP_PULL_OPERATION },
    { id: "IMAP-7", label: "A burst: thirty customers each ask after their own order at once", operation: IMAP_PULL_OPERATION },
]

/** The mailbox's hardcoded catalogue, registered at boot. */
export const IMAP_SANDBOX_CATALOGUE: SandboxCatalogue = { provider: IMAP_SANDBOX_PROVIDER, cases: IMAP_SANDBOX_CASES }
