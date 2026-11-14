import type { SandboxCase, SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** The provider key of a personal Telegram account. */
export const TELEGRAM_USER_SANDBOX_PROVIDER = "telegram_user"

/** The operation of the pull in the sandbox call log and in the account's next-case selector. */
export const TELEGRAM_USER_PULL_OPERATION = "pull"

/** The ids of the cases, by what they prove (the implementation reads `state.nextCase` against them; TELEGRAM_USER-1 is the default). */
export const TELEGRAM_USER_CASE = {
    firstRead: "TELEGRAM_USER-1",
    newLines: "TELEGRAM_USER-2",
    busyGroup: "TELEGRAM_USER-3",
    sessionRevoked: "TELEGRAM_USER-4",
    notConfigured: "TELEGRAM_USER-5",
    unreachable: "TELEGRAM_USER-6",
} as const

/** The moments of the sandbox account's chats (R60: a fixed history). A case reads the chats AS OF a moment. */
export const TELEGRAM_USER_AS_OF = { first: 1, newLines: 2, busyGroup: 3 } as const

/** The most messages one chat gives one pull (the live pull's own bound, `MAX_PER_CHAT_PER_RUN`): the busy group meets it. */
export const TELEGRAM_USER_PER_CHAT_LIMIT = 200

/** The size of the busy group's history (TELEGRAM_USER-3): more than one pull takes. */
const BUSY_GROUP_SIZE = 250

/** The first moment of the chats' history, in epoch seconds (2026-11-10T03:00:00Z); every message is a minute after the one before it, per chat. */
const HISTORY_START_UNIX = Date.UTC(2026, 10, 10, 3, 0, 0) / 1000

/** One message of a sandbox chat, in the words of Telegram's own read (the id runs per chat, the date derives from it). */
export interface SandboxTelegramMessage {
    readonly id: number
    /** From which moment the message is there. */
    readonly asOf: number
    readonly senderName: string
    readonly text: string
    readonly replyToId: number | null
    readonly hasMedia: boolean
}

/** One chat the sandbox account holds: the id and title the live wizard would have saved, its kind and its messages in id order. */
export interface SandboxTelegramChat {
    readonly id: string
    readonly title: string
    readonly kind: "user" | "group"
    readonly messages: ReadonlyArray<SandboxTelegramMessage>
}

/** A text line of a chat. */
const line = (id: number, asOf: number, senderName: string, text: string, replyToId: number | null = null): SandboxTelegramMessage => ({
    id,
    asOf,
    senderName,
    text,
    replyToId,
    hasMedia: false,
})

/** The busy group's messages: ids 1 .. 250, all there from the third moment. */
const busyGroupMessages = (): ReadonlyArray<SandboxTelegramMessage> =>
    Array.from({ length: BUSY_GROUP_SIZE }, (_, index) => line(index + 1, TELEGRAM_USER_AS_OF.busyGroup, "Thanh vien", `Tin nhan so ${String(index + 1)}`))

/** The chats of the sandbox account (the live account holds the ones its owner ticked; the sandbox has these three, fixed). */
export const TELEGRAM_USER_SANDBOX_CHATS: ReadonlyArray<SandboxTelegramChat> = [
    {
        id: "-1001000000001",
        title: "Nhom khach quen",
        kind: "group",
        messages: [
            line(1, 1, "Chi Hoa", "Hang ao thun ve chua shop?"),
            line(2, 1, "Chi Hoa", "Con mau den size M khong a?", 1),
            line(3, 2, "Anh Tuan", "Shop oi cho minh dat 2 cai ao thun den."),
        ],
    },
    {
        id: "1000000001",
        title: "Nguyen Van An",
        kind: "user",
        messages: [
            line(1, 1, "Nguyen Van An", "Chao shop, gia ao thun bao nhieu vay?"),
            { id: 2, asOf: 1, senderName: "Nguyen Van An", text: "", replyToId: null, hasMedia: true },
            line(3, 2, "Nguyen Van An", "Minh chuyen khoan roi nhe.", 1),
            line(4, 2, "Nguyen Van An", "Shop kiem tra giup minh."),
        ],
    },
    { id: "-1001000000002", title: "Nhom ban hang", kind: "group", messages: busyGroupMessages() },
]

/** The date of a message, in epoch seconds: a minute per id after the start of the history. */
export const telegramUserDateOf = (message: SandboxTelegramMessage): number => HISTORY_START_UNIX + message.id * 60

/** The sentence the sandbox's unreachable Telegram carries as its detail (TELEGRAM_USER-6): a fixed line, UNVERIFIED against the live words. */
export const TELEGRAM_USER_SANDBOX_UNREACHABLE = "sandbox: telegram did not answer in time"

/** The outbound cases of the personal Telegram pull: the account's NEXT CASE picks what the next pull meets; TELEGRAM_USER-1 answers while nothing is picked. */
export const TELEGRAM_USER_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: TELEGRAM_USER_CASE.firstRead,
        label: "A first read: a group of regulars asks after stock (2 lines) and one customer asks a price and sends a picture (2 messages); each chat's cursor moves to its newest message",
        operation: TELEGRAM_USER_PULL_OPERATION,
        default: true,
    },
    {
        id: TELEGRAM_USER_CASE.newLines,
        label: "New lines: an order in the group and a payment note in the private chat arrived after the last cursor; only they are brought",
        operation: TELEGRAM_USER_PULL_OPERATION,
    },
    {
        id: TELEGRAM_USER_CASE.busyGroup,
        label: "A busy group: 250 lines in one chat; one pull takes 200 and says older lines are left, the next takes the other 50",
        operation: TELEGRAM_USER_PULL_OPERATION,
    },
    {
        id: TELEGRAM_USER_CASE.sessionRevoked,
        label: "The session is gone: Telegram ended it (signed out in Devices); the run is refused and the owner is told to reconnect",
        operation: TELEGRAM_USER_PULL_OPERATION,
    },
    {
        id: TELEGRAM_USER_CASE.notConfigured,
        label: "The deployment has no Telegram app credentials: the run cannot talk to Telegram at all",
        operation: TELEGRAM_USER_PULL_OPERATION,
    },
    {
        id: TELEGRAM_USER_CASE.unreachable,
        label: "Telegram does not answer in time: nothing is read, the run is unavailable and is tried again",
        operation: TELEGRAM_USER_PULL_OPERATION,
    },
]

/** The personal Telegram's hardcoded catalogue, registered at boot. */
export const TELEGRAM_USER_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: TELEGRAM_USER_SANDBOX_PROVIDER,
    cases: TELEGRAM_USER_SANDBOX_CASES,
}
