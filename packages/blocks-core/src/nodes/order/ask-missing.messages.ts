import type { MissingReason } from "./order.schema"

/** The languages the customer is asked in. */
export type AskLocale = "vi" | "en"

/** The words of a question for what an order lacks: the opening line and one line per reason. */
export interface AskWords {
    /** The opening line. */
    readonly intro: string
    /** One line per reason; `{{item}}` is the item the gap is about. */
    readonly reasons: Readonly<Record<MissingReason, string>>
}

/** The words by language. They ask; they promise nothing about payment, delivery or time. */
export const ASK_WORDS: Readonly<Record<AskLocale, AskWords>> = {
    vi: {
        intro: "Để ghi nhận đơn, shop cần thêm thông tin:",
        reasons: {
            no_items: "Bạn muốn đặt những món nào và số lượng bao nhiêu?",
            not_in_catalogue: "Shop chưa có “{{item}}”, bạn chọn món khác giúp shop nhé.",
            no_price: "Shop chưa có giá cho “{{item}}”.",
            no_address: "Bạn cho shop xin địa chỉ nhận hàng nhé?",
        },
    },
    en: {
        intro: "To note down the order, we need a little more:",
        reasons: {
            no_items: "Which items would you like, and how many?",
            not_in_catalogue: "We do not have “{{item}}”; could you pick another item?",
            no_price: "We have no price for “{{item}}”.",
            no_address: "Could you give us the delivery address?",
        },
    },
}
