/** The sentences of the contract import (Vietnamese; the refusals travel as the `detail` of an invalid request). */
export const CONTRACT_IMPORT_COPY = {
    /** Neither a file nor pasted text was given. */
    chooseSource: "Hãy chọn tệp .csv/.xlsx hoặc dán bảng hợp đồng.",
    /** No column was chosen for the customer or the end day. */
    chooseColumns: "Hãy chọn cột khách hàng và cột ngày kết thúc.",
    /** More rows than one import takes. */
    tooManyRows: (max: number): string => `Mỗi lần nhập tối đa ${max} hợp đồng. Hãy chia tệp nhỏ hơn.`,
    /** The note added when the first day was derived from the last one. */
    derivedStart: "Ngày bắt đầu được suy ra: ngày kết thúc trừ 1 năm.",
} as const
