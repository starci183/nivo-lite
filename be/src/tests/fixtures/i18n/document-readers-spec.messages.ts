/** A UTF-16 text file body of the reader fixtures, as the characters decode, with its Windows line break. */
export const NOTES_FILE_VI = "Ghi chú: mở cửa 7 giờ.\r\nNghỉ Tết từ 28 đến mùng 4."

/** The same notes after decoding: one newline style. */
export const NOTES_DECODED_VI = "Ghi chú: mở cửa 7 giờ.\nNghỉ Tết từ 28 đến mùng 4."

/** A Markdown policy file of the reader fixtures. */
export const POLICY_FILE_VI =
    "# Chính sách đổi trả\n\nĐổi hoa trong 2 giờ nếu hoa héo.\n\n## Hoàn tiền\n\nHoàn 100% khi giao trễ quá 1 giờ.\n"

/** Heading of the first policy section. */
export const POLICY_RETURNS_HEADING_VI = "Chính sách đổi trả"

/** Text under the first policy section. */
export const POLICY_RETURNS_TEXT_VI = "Đổi hoa trong 2 giờ nếu hoa héo."

/** Heading of the second policy section. */
export const POLICY_REFUND_HEADING_VI = "Hoàn tiền"

/** Text under the second policy section. */
export const POLICY_REFUND_TEXT_VI = "Hoàn 100% khi giao trễ quá 1 giờ."

/** A semicolon-delimited price file with quoted cells, doubled quotes and an empty row. */
export const PRICES_CSV_VI =
    'Món;Giá;Ghi chú\r\nBó hồng đỏ;350.000;"Có ""thiệp""; giao nhanh"\r\nLẵng hướng dương;520.000;\r\n;;\r\nHoa cưới;"1.200.000";đặt trước\r\n'

/** The rows PRICES_CSV_VI parses to. */
export const PRICES_CSV_ROWS_VI: ReadonlyArray<ReadonlyArray<string>> = [
    ["Món", "Giá", "Ghi chú"],
    ["Bó hồng đỏ", "350.000", 'Có "thiệp"; giao nhanh'],
    ["Lẵng hướng dương", "520.000", ""],
    ["", "", ""],
    ["Hoa cưới", "1.200.000", "đặt trước"],
]

/** A tab-delimited price file with a pipe inside a cell. */
export const PRICES_TSV_VI = "Món\tGiá\nBó cúc|trắng\t150.000\nHoa lan\t800.000\n"

/** Table name used by the table spec. */
export const TABLE_NAME_VI = "Bảng"

/** Header of the price table. */
export const TABLE_HEADER_VI: ReadonlyArray<string> = ["Món", "Giá"]

/** First data row of the price table, the pipe turned into a slash. */
export const TABLE_ROW_CUC_VI: ReadonlyArray<string> = ["Bó cúc/trắng", "150.000"]

/** Second data row of the price table. */
export const TABLE_ROW_LAN_VI: ReadonlyArray<string> = ["Hoa lan", "800.000"]

/** The table as text, one line per row. */
export const TABLE_TEXT_VI = "Món | Giá\nBó cúc/trắng | 150.000\nHoa lan | 800.000"
