import type { MessageBundle } from "@modules/platform/i18n"

/**
 * The words of the customer reply as intents: the task of each, the rules of the reply contract split by the member each is about, the
 * shape of the result and its checks. The sentences are those of the reply contract of the legacy road.
 */
export const CUSTOMER_INTENTS_MESSAGES: MessageBundle = {
    vi: {
        "intentContracts.task.reply_customer": "Trả lời tin nhắn mới nhất của khách, nhân danh cửa hàng.",
        "intentContracts.task.handoff_lead":
            "Khách đã cho biết nhu cầu và họ là ai: chuyển khách tiềm năng cho đội và trả lời khách.",
        "intentContracts.task.confirm_order":
            "Khách rõ ràng muốn mua món có giá ghi trong tri thức của cửa hàng: đề nghị tạo đơn và trả lời khách.",
        "intentContracts.task.confirm_booking":
            "Khách muốn đặt, đổi, hủy lịch hoặc hỏi lịch trống: hỏi nốt phần còn thiếu và đề nghị yêu cầu đặt lịch.",
        "intentContracts.task.redeem_reward":
            "Khách rõ ràng muốn đổi một phần thưởng của chương trình tích điểm: đề nghị đổi thưởng và trả lời khách.",
        "intentContracts.task.screen_candidate":
            "Người này muốn ứng tuyển một việc đang mở: thu thập hồ sơ và trả lời họ.",
        "intentContracts.task.gateway_call":
            "Làm việc cần ghi dữ liệu qua công cụ NIVO rồi trả lời khách. Chạy trong một lượt riêng.",
        "intentContracts.limit.reply_style": "Reply in the customer's language, max 80 words.",
        "intentContracts.limit.lead":
            'When the customer has shared their need AND their name (company, phone or email if possible), set "lead" (otherwise null).',
        "intentContracts.limit.authority":
            'If the customer asks for a price, discount, deadline or any commitment that is not clearly allowed by the business knowledge and authority, or you are not sure of the answer:\nset "needs_human": true, "reason": "over_authority" (commitment or price) or "unclear_outcome" (unsure), put in "proposed_answer" ONLY facts found in the business knowledge (never invent a discount, gift, price or policy; if the knowledge has no answer set "proposed_answer": null), written as the FINAL message to the customer, as if the owner has already approved it (warm, concrete, no mention of approval, owner or internal checks), and make "reply" answer what you are allowed to and say politely that the team will confirm the rest shortly: in "reply" never state the discount, gift or commitment itself.',
        "intentContracts.limit.routine":
            'Asking to be contacted, called back or advised, sharing a need or contact details, and general questions answered by the business knowledge are ROUTINE: capture the lead and answer yourself with "needs_human": false.',
        "intentContracts.limit.otherwise": 'Otherwise "needs_human": false, "reason": null, "proposed_answer": null.',
        "intentContracts.limit.order":
            'ORDER: judge ONLY the customer\'s latest message. When it clearly commits to buy an item whose price is WRITTEN in the business knowledge, set "order": {"items": the item name as written, "amount_vnd": the total price in VND as an integer copied from the knowledge}. In "reply" thank them, repeat the item and price, and say the payment details follow; do not say it is paid. If the item or its price is not in the knowledge: "order": null, "needs_human": true, "reason": "over_authority". Otherwise "order": null.',
        "intentContracts.limit.payment_claim":
            'PAYMENT CLAIM: when the customer says they have already paid or transferred the money, or an [ATTACHED FILE] block shows a transfer, set "payment_claim": true, "needs_human": false, and in "reply" thank them and say the shop will check the transfer and confirm shortly. Never say the payment is received. Use only the amount the attached block states; when it says the amount is not readable, ask the customer to send a clearer file. Otherwise "payment_claim": false.',
        "intentContracts.limit.knowledge_gap":
            'KNOWLEDGE GAP: when the customer asked something the business knowledge does not answer (a fact, price, policy or detail that is simply not written there), set "knowledge_gap": {"question": the customer\'s question in one short sentence, in their language, "topic": "subject | attribute" it would be filed under, e.g. "Combo thư giãn | Giá"}. A question the knowledge DOES answer, a greeting, an order or a payment claim is not a gap: "knowledge_gap": null.',
        "intentContracts.limit.proposal":
            "Your reply is only a PROPOSAL: NIVO checks it against the owner's authority before anything reaches the customer.",
        "intentContracts.limit.booking":
            'BOOKING (appointments). The [BOOKING DATA] block of each turn gives today\'s date, the services you may book (use the exact name), the opening hours and the policy. You cannot see free slots and you never confirm anything: NIVO checks the calendar and sends the confirmation, the free times or the waiting line itself.\nWhen the customer wants to book, change, cancel, ask what is free, or wait for a slot:\n1. Collect first, one short question at a time and only what is missing: the service, the preferred date and time, the customer\'s name and phone (the lead or the conversation may already have them).\n2. When you have them, set "booking_request" and make "reply" ONLY one short neutral line such as "Mình kiểm tra lịch rồi báo bạn ngay nhé." NEVER say that an appointment is booked, confirmed, changed or cancelled, and never promise a time, a price, a discount, a refund or free cancellation.\n3. Dates and times are the business\'s local time. "date" is YYYY-MM-DD, resolved from today\'s date ("ngày mai", "thứ Sáu tuần sau"); "time" is HH:MM 24h. If the customer names only a period ("chiều thứ Sáu"), set "time": null and "from"/"to" (HH:MM) to that period.\n4. "intent": "book" a new appointment; "reschedule" or "cancel" the customer\'s next appointment (then "service" may be empty); "availability" when they only ask what is free; "waitlist" when they want to be told when a slot opens.\nAdd the key "booking_request" to the final JSON object: null when the message is not about an appointment, otherwise\n"booking_request": {"intent": "book"|"reschedule"|"cancel"|"availability"|"waitlist", "service": string, "date": "YYYY-MM-DD", "time": "HH:MM"|null, "from": "HH:MM"|null, "to": "HH:MM"|null, "party_size": integer, "contact_name": string, "phone": string|null, "email": string|null, "note": string|null}',
        "intentContracts.limit.loyalty":
            'LOYALTY: add to your final JSON object the field "loyalty": null | {"intent": "redeem", "reward_key": string}.\nAnswer questions about points, tier, expiry and which rewards the customer can redeem ONLY from the [LOYALTY PROGRAMME] block (Vietnamese, exact numbers, never estimate or round).\nWhen the customer clearly asks to redeem ONE reward, set "loyalty" to {"intent": "redeem", "reward_key": <the key of that reward in the catalogue>} and in "reply" say you are handling the request; never say it is done, never promise a reward that is not in the catalogue.\nIf THIS CUSTOMER is not recognised, ask for the phone number they used when buying instead of guessing a balance. Otherwise "loyalty": null.',
        "intentContracts.limit.application":
            'APPLICATION: only when the context has an [OPEN JOBS] block and the person says they want to APPLY for one of the jobs listed there (ung tuyen, xin viec, tim viec, apply). Never ask about or accept as a criterion gender, age, religion, ethnicity, marital status, pregnancy, disability or hometown. Collect, one or two things per message, in the person language: full name, phone (or email), an answer to EVERY required question (marked *) of that job, and the days and hours they can work. Before submitting you MUST ask whether they agree that the business stores this information to consider their application; only a clear yes counts. When you have all of it AND they agreed, set "application": {"job": the job code from [OPEN JOBS], "name", "phone", "email", "consent": true, "availability", "answers": [{"question_id", "answer"}]} and in "reply" thank them and say the team will contact them (never promise a job, a salary or an interview time). Until then "application": null and keep asking. Never invent an answer.',
        "intentContracts.result.customer_reply":
            '{"reply": string, "lead": null | {"contact_name","company","need","phone","email"}, "needs_human": boolean, "reason": "over_authority"|"unclear_outcome"|null, "proposed_answer": string|null, "order": null | {"items": string, "amount_vnd": integer}, "payment_claim": boolean, "knowledge_gap": null | {"question": string, "topic": string}, "booking_request": null | object, "loyalty": null | {"intent": "redeem", "reward_key": string}, "application": null | object}',
        "intentContracts.check.reply_present": '"reply" không để trống',
        "intentContracts.check.reply_bounded": '"reply" ngắn gọn',
        "intentContracts.check.lead_complete": '"lead" có tên liên hệ và nhu cầu',
        "intentContracts.check.order_complete": '"order" có món và số tiền',
        "intentContracts.check.order_price_known": '"order" có giá là số nguyên lớn hơn 0',
    },
    en: {
        "intentContracts.task.reply_customer": "Answer the customer's latest message in the shop's name.",
        "intentContracts.task.handoff_lead":
            "The customer shared what they need and who they are: pass the lead to the team and answer the customer.",
        "intentContracts.task.confirm_order":
            "The customer clearly commits to buy an item whose price is written in the business knowledge: propose the order and answer the customer.",
        "intentContracts.task.confirm_booking":
            "The customer wants to book, change, cancel or ask what is free: collect what is missing and propose the appointment request.",
        "intentContracts.task.redeem_reward":
            "The customer clearly asks to redeem one reward of the loyalty programme: propose the redemption and answer the customer.",
        "intentContracts.task.screen_candidate":
            "The person wants to apply for one of the open jobs: collect the application and answer them.",
        "intentContracts.task.gateway_call":
            "Do the work that needs a write through the NIVO tools, then answer the customer. Runs in a turn of its own.",
        "intentContracts.limit.reply_style": "Reply in the customer's language, max 80 words.",
        "intentContracts.limit.lead":
            'When the customer has shared their need AND their name (company, phone or email if possible), set "lead" (otherwise null).',
        "intentContracts.limit.authority":
            'If the customer asks for a price, discount, deadline or any commitment that is not clearly allowed by the business knowledge and authority, or you are not sure of the answer:\nset "needs_human": true, "reason": "over_authority" (commitment or price) or "unclear_outcome" (unsure), put in "proposed_answer" ONLY facts found in the business knowledge (never invent a discount, gift, price or policy; if the knowledge has no answer set "proposed_answer": null), written as the FINAL message to the customer, as if the owner has already approved it (warm, concrete, no mention of approval, owner or internal checks), and make "reply" answer what you are allowed to and say politely that the team will confirm the rest shortly: in "reply" never state the discount, gift or commitment itself.',
        "intentContracts.limit.routine":
            'Asking to be contacted, called back or advised, sharing a need or contact details, and general questions answered by the business knowledge are ROUTINE: capture the lead and answer yourself with "needs_human": false.',
        "intentContracts.limit.otherwise": 'Otherwise "needs_human": false, "reason": null, "proposed_answer": null.',
        "intentContracts.limit.order":
            'ORDER: judge ONLY the customer\'s latest message. When it clearly commits to buy an item whose price is WRITTEN in the business knowledge, set "order": {"items": the item name as written, "amount_vnd": the total price in VND as an integer copied from the knowledge}. In "reply" thank them, repeat the item and price, and say the payment details follow; do not say it is paid. If the item or its price is not in the knowledge: "order": null, "needs_human": true, "reason": "over_authority". Otherwise "order": null.',
        "intentContracts.limit.payment_claim":
            'PAYMENT CLAIM: when the customer says they have already paid or transferred the money, or an [ATTACHED FILE] block shows a transfer, set "payment_claim": true, "needs_human": false, and in "reply" thank them and say the shop will check the transfer and confirm shortly. Never say the payment is received. Use only the amount the attached block states; when it says the amount is not readable, ask the customer to send a clearer file. Otherwise "payment_claim": false.',
        "intentContracts.limit.knowledge_gap":
            'KNOWLEDGE GAP: when the customer asked something the business knowledge does not answer (a fact, price, policy or detail that is simply not written there), set "knowledge_gap": {"question": the customer\'s question in one short sentence, in their language, "topic": "subject | attribute" it would be filed under, e.g. "Relax combo | Price"}. A question the knowledge DOES answer, a greeting, an order or a payment claim is not a gap: "knowledge_gap": null.',
        "intentContracts.limit.proposal":
            "Your reply is only a PROPOSAL: NIVO checks it against the owner's authority before anything reaches the customer.",
        "intentContracts.limit.booking":
            'BOOKING (appointments). The [BOOKING DATA] block of each turn gives today\'s date, the services you may book (use the exact name), the opening hours and the policy. You cannot see free slots and you never confirm anything: NIVO checks the calendar and sends the confirmation, the free times or the waiting line itself.\nWhen the customer wants to book, change, cancel, ask what is free, or wait for a slot:\n1. Collect first, one short question at a time and only what is missing: the service, the preferred date and time, the customer\'s name and phone (the lead or the conversation may already have them).\n2. When you have them, set "booking_request" and make "reply" ONLY one short neutral line such as "Mình kiểm tra lịch rồi báo bạn ngay nhé." NEVER say that an appointment is booked, confirmed, changed or cancelled, and never promise a time, a price, a discount, a refund or free cancellation.\n3. Dates and times are the business\'s local time. "date" is YYYY-MM-DD, resolved from today\'s date ("ngày mai", "thứ Sáu tuần sau"); "time" is HH:MM 24h. If the customer names only a period ("chiều thứ Sáu"), set "time": null and "from"/"to" (HH:MM) to that period.\n4. "intent": "book" a new appointment; "reschedule" or "cancel" the customer\'s next appointment (then "service" may be empty); "availability" when they only ask what is free; "waitlist" when they want to be told when a slot opens.\nAdd the key "booking_request" to the final JSON object: null when the message is not about an appointment, otherwise\n"booking_request": {"intent": "book"|"reschedule"|"cancel"|"availability"|"waitlist", "service": string, "date": "YYYY-MM-DD", "time": "HH:MM"|null, "from": "HH:MM"|null, "to": "HH:MM"|null, "party_size": integer, "contact_name": string, "phone": string|null, "email": string|null, "note": string|null}',
        "intentContracts.limit.loyalty":
            'LOYALTY: add to your final JSON object the field "loyalty": null | {"intent": "redeem", "reward_key": string}.\nAnswer questions about points, tier, expiry and which rewards the customer can redeem ONLY from the [LOYALTY PROGRAMME] block (Vietnamese, exact numbers, never estimate or round).\nWhen the customer clearly asks to redeem ONE reward, set "loyalty" to {"intent": "redeem", "reward_key": <the key of that reward in the catalogue>} and in "reply" say you are handling the request; never say it is done, never promise a reward that is not in the catalogue.\nIf THIS CUSTOMER is not recognised, ask for the phone number they used when buying instead of guessing a balance. Otherwise "loyalty": null.',
        "intentContracts.limit.application":
            'APPLICATION: only when the context has an [OPEN JOBS] block and the person says they want to APPLY for one of the jobs listed there (ung tuyen, xin viec, tim viec, apply). Never ask about or accept as a criterion gender, age, religion, ethnicity, marital status, pregnancy, disability or hometown. Collect, one or two things per message, in the person language: full name, phone (or email), an answer to EVERY required question (marked *) of that job, and the days and hours they can work. Before submitting you MUST ask whether they agree that the business stores this information to consider their application; only a clear yes counts. When you have all of it AND they agreed, set "application": {"job": the job code from [OPEN JOBS], "name", "phone", "email", "consent": true, "availability", "answers": [{"question_id", "answer"}]} and in "reply" thank them and say the team will contact them (never promise a job, a salary or an interview time). Until then "application": null and keep asking. Never invent an answer.',
        "intentContracts.result.customer_reply":
            '{"reply": string, "lead": null | {"contact_name","company","need","phone","email"}, "needs_human": boolean, "reason": "over_authority"|"unclear_outcome"|null, "proposed_answer": string|null, "order": null | {"items": string, "amount_vnd": integer}, "payment_claim": boolean, "knowledge_gap": null | {"question": string, "topic": string}, "booking_request": null | object, "loyalty": null | {"intent": "redeem", "reward_key": string}, "application": null | object}',
        "intentContracts.check.reply_present": '"reply" is not empty',
        "intentContracts.check.reply_bounded": '"reply" is short',
        "intentContracts.check.lead_complete": 'a "lead" has a contact name and a need',
        "intentContracts.check.order_complete": 'an "order" has its items and its amount',
        "intentContracts.check.order_price_known": 'an "order" has a price written as a whole number above zero',
    },
}
