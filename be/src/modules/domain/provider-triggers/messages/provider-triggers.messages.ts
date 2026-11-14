import type { MessageBundle } from "@modules/platform/i18n"
import type { TriggerWords } from "../provider-triggers.contracts"

/** Display text of the provider triggers codes, Vietnamese and English. */
export const PROVIDER_TRIGGERS_MESSAGES: MessageBundle = {
    vi: {
        "errors.PROVIDER_TRIGGERS_UNDECLARED": "Provider của tài khoản này không có trigger tên đó.",
        "errors.PROVIDER_TRIGGERS_UNKNOWN_ACCOUNT": "Không tìm thấy tài khoản kết nối này trong workspace.",
        "errors.PROVIDER_TRIGGERS_NOT_DECIDED":
            "Trigger này không có agent quyết định: mọi agent đã đăng ký đều chỉ được báo tin.",
        "errors.PROVIDER_TRIGGERS_CORE_DECIDES":
            "Agent lõi đang quyết định các sự kiện của tài khoản này; chỉ chọn được agent khác khi không còn agent lõi.",
        "errors.PROVIDER_TRIGGERS_NOT_ATTACHED": "Agent này chưa được gắn với tài khoản kết nối.",
        "errors.PROVIDER_TRIGGERS_DECLARATION_TAKEN": "Đã có một khai báo trigger khác cùng nguồn và cùng tên.",
        "errors.PROVIDER_TRIGGERS_DECLARATION_UNKNOWN": "Khai báo trigger này chưa được đăng ký cho nguồn của nó.",
    },
    en: {
        "errors.PROVIDER_TRIGGERS_UNDECLARED": "The provider of this account declares no trigger of that name.",
        "errors.PROVIDER_TRIGGERS_UNKNOWN_ACCOUNT": "This workspace has no such connected account.",
        "errors.PROVIDER_TRIGGERS_NOT_DECIDED":
            "Nobody decides on this trigger's events: every registered agent is only told.",
        "errors.PROVIDER_TRIGGERS_CORE_DECIDES":
            "The core agent decides on this account's events; another agent can be chosen only where no core agent is bound.",
        "errors.PROVIDER_TRIGGERS_NOT_ATTACHED": "This agent is not attached to the connected account.",
        "errors.PROVIDER_TRIGGERS_DECLARATION_TAKEN": "Another trigger declaration of the same source and name is registered.",
        "errors.PROVIDER_TRIGGERS_DECLARATION_UNKNOWN": "This trigger declaration is not registered for its source.",
    },
}

/** What the owner reads when an event could not be handed to an agent: kept on the account, in Vietnamese as the product does. */
export const TRIGGER_DEAD_NOTICE =
    "Một sự kiện từ kết nối này không giao được cho agent sau nhiều lần thử. Sự kiện được giữ lại, không bị mất. Hãy kiểm tra agent và quy trình đã đăng ký."

/** The words of the bank trigger and its fields. */
export const BANK_TRIGGER_WORDS: Readonly<Record<"trigger" | "transactionId" | "direction", TriggerWords>> = {
    trigger: {
        vi: "Có giao dịch mới trên tài khoản ngân hàng (tiền vào hoặc tiền ra).",
        en: "A new movement on the bank account (money in or money out).",
    },
    transactionId: {
        vi: "Mã bản ghi giao dịch trong NIVO; đọc chi tiết qua công cụ giao dịch ngân hàng.",
        en: "The id of the transaction record in NIVO; read its details through the bank transaction tool.",
    },
    direction: {
        vi: "Chiều tiền: in là tiền vào, out là tiền ra.",
        en: "The direction of the money: in is a credit, out is a debit.",
    },
}

/** The words of a compose provider's render trigger and its fields. */
export const RENDER_TRIGGER_WORDS: Readonly<Record<"trigger" | "renderRowId" | "renderId" | "status", TriggerWords>> = {
    trigger: {
        vi: "Một video đã dựng xong (hoặc dựng lỗi).",
        en: "A video render finished (done or failed).",
    },
    renderRowId: {
        vi: "Mã bản ghi kết quả dựng trong NIVO.",
        en: "The id of the render row in NIVO.",
    },
    renderId: {
        vi: "Mã lần dựng tại nhà cung cấp.",
        en: "The provider's id of the render.",
    },
    status: {
        vi: "done là xong, failed là lỗi.",
        en: "done or failed.",
    },
}

/** The words of the mailbox trigger and its fields. */
export const MAIL_TRIGGER_WORDS: Readonly<Record<"trigger" | "eventIds" | "count", TriggerWords>> = {
    trigger: {
        vi: "Hộp thư vừa đồng bộ và có thư mới.",
        en: "The mailbox was just synced and holds new mail.",
    },
    eventIds: {
        vi: "Mã các lần đồng bộ có thư mới; thư được đọc qua công cụ danh sách thư.",
        en: "The ids of the syncs that brought new mail; the mails are read through the mail list tool.",
    },
    count: {
        vi: "Số thư được ghi trong lần đồng bộ.",
        en: "How many mails the sync wrote.",
    },
}
