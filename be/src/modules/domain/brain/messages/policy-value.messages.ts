/**
 * The Vietnamese words a written policy value is read from and written with. They are data for the parser of `policy-value.policy.ts`:
 * alternations of words (with and without accents), joined into regular expressions by the parser.
 */

/** Scale words of an amount of money. */
export const SCALE_WORDS = {
    /** One billion. */
    billion: "tỷ|ty",
    /** One million. */
    million: "triệu|trieu|tr",
    /** One thousand. */
    thousand: "nghìn|nghin|ngàn|ngan|k",
} as const

/** Duration words, by the unit they name. */
export const DURATION_WORDS = {
    /** Minutes. */
    minute: "phút|phut|p",
    /** Hours. */
    hour: "giờ|gio|tiếng|tieng|h",
    /** Days. */
    day: "ngày|ngay",
    /** Weeks. */
    week: "tuần|tuan",
} as const

/** The currency words that may follow an amount. */
export const CURRENCY_WORDS = "đ|₫|d|vnd|đồng|dong"

/** The openers of the per-unit words after an amount (a slash, "một", "mỗi"). */
export const PER_UNIT_OPENERS = "/|một |mỗi |mot |moi "

/** The words that follow a percentage. */
export const PERCENT_WORDS = "%|phần trăm|phan tram"

/** The words that may open a time range ("from"), as a regular-expression source. */
export const TIME_FROM_WORDS: string = String.raw`từ\s+|tu\s+`

/** The separators of a time range ("to"), as a regular-expression source. */
export const TIME_TO_WORDS = "-|–|—|đến|den|tới|toi"

/** Written forms that read as yes. */
export const YES_WORDS: ReadonlyArray<string> = ["có", "co", "yes", "true", "đúng", "dung"]

/** Written forms that read as no. */
export const NO_WORDS: ReadonlyArray<string> = ["không", "khong", "no", "false", "sai"]

/** Written forms that read as a price of zero. */
export const FREE_WORDS: ReadonlyArray<string> = ["miễn phí", "mien phi", "free"]

/** The currency sign a stored money value ends its amount with. */
export const CURRENCY_SIGN = "đ"

/** The unit words a stored duration is written with. */
export const DURATION_UNIT_WORDS = {
    /** Days. */
    day: "ngày",
    /** Hours. */
    hour: "giờ",
    /** Minutes. */
    minute: "phút",
} as const

/** A stored yes. */
export const YES_TEXT = "Có"

/** A stored no. */
export const NO_TEXT = "Không"
