/** The opening words of the reason a wrong-code transfer stop gives, before its transfer code. */
export const WRONG_CODE_REASON_LEAD_VI = "Chuyển khoản 3.000 ₫ với mã"

/** The closing words of the reason a wrong-code transfer stop gives, after its transfer code. */
export const WRONG_CODE_REASON_TAIL_VI = "không khớp đơn nào đang mở; số tiền bằng đúng đơn đang chờ."

/** The question a wrong-code transfer stop asks the founder. */
export const WRONG_CODE_QUESTION_VI = "Có ghi nhận chuyển khoản sai mã này cho đơn đang chờ không?"

/** The display name of the founder who answers the stops. */
export const FOUNDER_NAME_VI = "Chủ tiệm Hà"

/** The subject of the drafted lesson: a wrong-code transfer. */
export const LESSON_SUBJECT_VI = "Chuyển khoản sai mã"

/** The attribute of the drafted lesson: the exact amount of the waiting order. */
export const LESSON_ATTRIBUTE_VI = "Đúng số tiền của đơn đang chờ"

/** The value of the drafted lesson: book it to the waiting order. */
export const LESSON_VALUE_VI = "ghi nhận cho đơn đang chờ"

/** The topic of the drafted lesson. */
export const LESSON_TOPIC_VI = "chuyển khoản sai mã nhưng đúng số tiền"

/** The founder's first answer: book it to the waiting order. */
export const AGREE_FIRST_VI = "Ghi nhận cho đơn đang chờ đi em"

/** The founder's second answer, agreeing with the first. */
export const AGREE_SECOND_VI = "Cứ ghi nhận cho đơn đang chờ"

/** A third answer in the same words as the first two. */
export const AGREE_THIRD_VI = "Ghi nhận cho đơn đang chờ nhé"

/** A plain answer: book it to the waiting order. */
export const PLAIN_ANSWER_VI = "Ghi nhận cho đơn đang chờ"

/** A short answer: book it. */
export const SHORT_ANSWER_VI = "Ghi nhận đi"

/** An answer that says: retry. */
export const RETRY_ANSWER_VI = "Thử lại"

/** An answer that books the transfer to order 0004. */
export const ONE_ORDER_ANSWER_VI = "Ghi nhận cho đơn 0004 đi em"

/** The reason the engine writes on a card learned from the two agreeing answers. */
export const LEARNED_REASON_VI: string =
    "Đã hỏi chủ tiệm 2 lần về chuyển khoản sai mã nhưng đúng số tiền; chủ tiệm trả lời: 'Ghi nhận cho đơn đang chờ đi em'; " +
    "'Cứ ghi nhận cho đơn đang chờ'; đề nghị ghi thành quy định để lần sau tự xử lý."

/** A short learned reason a learning change carries. */
export const SHORT_LEARNED_REASON_VI = "Đã hỏi chủ tiệm 2 lần về chuyển khoản sai mã; …"

/** A single answer worded as a rule (VAT invoices). */
export const VAT_RULE_ANSWER_VI = "Có xuất VAT, khách gửi mã số thuế và email, phí 8%"

/** An answer that books a wrong-code transfer as paid. */
export const WRONG_CODE_PAID_ANSWER_VI = "Khoản 5.000đ này là của đơn DH-…, khách ghi nhầm mã. Ghi nhận đơn đó đã trả."

/** An answer that holds a duplicate transfer for a refund. */
export const DUPLICATE_HOLD_ANSWER_VI = "Khách chuyển trùng, giữ khoản này để hoàn lại, không ghi sổ"

/** An answer that books a twice-paid order as paid. */
export const PAID_TWICE_ANSWER_VI = "Khách chuyển 2 lần, đủ tiền đơn này, ghi nhận đã trả"

/** An answer that points to an earlier card. */
export const HANDLED_EARLIER_ANSWER_VI = "Đã xử lý ở thẻ trước"

/** The engine's own refusal text of a tool call, as an approval stop folds it into the answers. */
export const ENGINE_REFUSAL_VI =
    "Chủ cửa hàng không cho phép gọi nivo.tool.payment.transfer.create với các tham số này. Không gọi lại đúng lệnh đó cho việc này"

/** The first sentence of the engine's refusal text of a tool call. */
export const ENGINE_REFUSAL_HEAD_VI = "Chủ cửa hàng không cho phép gọi nivo.tool.payment.transfer.create với các tham số này."

/** A drafted subject naming a tool id. */
export const DRAFT_TOOL_SUBJECT_VI = "lệnh tạo QR nivo.tool.payment.transfer.create"

/** A drafted value naming a snake_case key. */
export const DRAFT_SNAKE_VALUE_VI = "ghi nhận cho đơn đang chờ theo order_has_money"

/** A rule in words that ends with its fee number. */
export const FEE_RULE_VI = "ghi nhận cho đơn đang chờ, phí 8"

/** The dong unit sign. */
export const DONG_UNIT_VI = "đ"

/** An answer that asks the customer for the transfer code again. */
export const ASK_AGAIN_ANSWER_VI = "Lần này hỏi lại khách mã chuyển khoản"

/** A drafted value outside the founder's words: refund double. */
export const DOUBLE_REFUND_VALUE_VI = "hoàn tiền gấp đôi cho khách"

/** An answer carrying a customer's phone number. */
export const PHONE_ANSWER_VI = "Gọi khách số 0912 345 678 rồi ghi nhận"

/** The same answer with the phone number masked. */
export const PHONE_MASKED_VI = "Gọi khách số … rồi ghi nhận"

/** A subject label of a value kept for one instance: transfer. */
export const TRANSFER_VI = "Chuyển khoản"

/** An attribute label of a value kept for one instance: wrong code. */
export const WRONG_CODE_VI = "Sai mã"

/** The reason a stop gives: the code matches no order. */
export const CODE_MISMATCH_REASON_VI = "Mã không khớp đơn nào."

/** The question a stop asks: book it? */
export const BOOK_IT_QUESTION_VI = "Có ghi nhận không?"

/** An answer: book it. */
export const BOOK_IT_VI = "Ghi nhận"

/** An answer: book it to order 0004. */
export const BOOK_ORDER_FOUR_VI = "Ghi nhận cho đơn 0004"

/** An answer after the founder switched the QR right on. */
export const QR_ALLOWED_ANSWER_VI = "Đã bật quyền tạo QR, gửi QR cho khách"

/** The reason of a bank-fed stop: a credit that names no order. */
export const CREDIT_NO_ORDER_REASON_VI = "Khoản 1.000đ, nội dung không chỉ đơn nào"

/** The question of a bank-fed stop: is the credit for SO-0003? */
export const CREDIT_ORDER_QUESTION_VI = "Khoản này của đơn SO-0003?"

/** The suggestion of a bank-fed stop: book it to SO-0003. */
export const BOOK_SO3_SUGGESTION_VI = "Ghi nhận cho SO-0003"

/** The amount fact of a bank-fed stop. */
export const AMOUNT_ONE_THOUSAND_VI = "1.000đ"

/** The title of the reconcile workflow. */
export const RECONCILE_TITLE_VI = "Đối soát tiền về"

/** The title of the match step. */
export const MATCH_STEP_TITLE_VI = "Khớp tiền với đơn"

/** The founder's answer: yes, it is SO-0003's. */
export const YES_SO3_ANSWER_VI = "Đúng, của SO-0003"

/** A line told to the customer while the stop is open. */
export const ACK_LINE_VI = "Dạ tiệm đã nhận 1.000đ, đang kiểm tra ạ"

/** A lower-case answer: book it. */
export const BOOK_IT_LOWER_VI = "ghi nhận"

/** The reason of a permission request: send the QR code for order DH-7. */
export const SEND_QR_REASON_VI = "Gửi mã QR cho đơn DH-7"

/** The owner's words refusing a permission request: do not send. */
export const DO_NOT_SEND_VI = "Không gửi"

/** The reason the AI core gives for a stop: the order is closed. */
export const ORDER_CLOSED_REASON_VI = "Đơn đã đóng"

/** The AI core's question: refund or keep the money? */
export const REFUND_OR_KEEP_VI = "Hoàn hay giữ?"

/** A suggestion of the AI core: keep it. */
export const KEEP_IT_VI = "Giữ lại"

/** The AI core's reason when the run's rights could not be read. */
export const RIGHTS_UNREAD_REASON_VI = "Không đọc được quyền"

/** The stored name of the shop's reconcile workflow. */
export const SHOP_RECONCILE_TITLE_VI = "Đối soát của tiệm"

/** The AI core's reason when it is unclear what to do. */
export const UNCLEAR_REASON_VI = "Chưa rõ"

/** The AI core's question: which order is it for? */
export const WHICH_ORDER_QUESTION_VI = "Của đơn nào?"

/** The founder's answer: it is for order SO-0003. */
export const OF_ORDER_SO3_VI = "Của đơn SO-0003"
