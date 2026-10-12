import type { Locale } from "@/i18n/core";
import type { LegalDoc } from "./types";

/* TODO(owner/lawyer): DRAFT. Approve the wording, the liability cap, the refund policy and the contact mailbox before launch. */

const vi: LegalDoc = {
  title: "Điều khoản sử dụng",
  draft: "Bản nháp - cập nhật lần cuối 12/10/2026",
  intro: "Khi tạo tài khoản hoặc dùng NIVO OS tại nivo.vn, bạn đồng ý với các điều khoản dưới đây.",
  sections: [
    { id: "service", title: "1. Dịch vụ", paragraphs: ["NIVO OS là phần mềm giúp doanh nghiệp nhỏ quản lý khách hàng, tin nhắn, thanh toán và công việc, với trợ lý AI hỗ trợ. Tính năng có thể thay đổi theo thời gian."] },
    { id: "accounts", title: "2. Tài khoản và không gian làm việc", paragraphs: ["Bạn cần cung cấp thông tin đúng và giữ bí mật thông tin đăng nhập. Chủ không gian làm việc chịu trách nhiệm về các thành viên được mời và các kết nối (Zalo OA, Telegram, SePay, Google) mà họ cấu hình."] },
    {
      id: "plans",
      title: "3. Gói dịch vụ và credit AI",
      items: [
        "Mỗi gói có mức credit AI hằng tháng. (TODO: xác nhận credit tháng có cộng dồn hay không.)",
        "Khi hết credit tháng, bạn có thể mua thêm gói nạp. Credit nạp có hiệu lực 12 tháng kể từ ngày mua.",
        "Thanh toán bằng chuyển khoản ngân hàng qua mã VietQR do SePay xử lý. Đơn hàng được xác nhận khi nhận được khoản chuyển đúng số tiền và nội dung.",
      ],
    },
    {
      id: "use",
      title: "4. Sử dụng chấp nhận được",
      items: [
        "Không dùng NIVO để gửi spam, lừa đảo hoặc nội dung trái pháp luật.",
        "Không xâm nhập, làm quá tải hệ thống hoặc truy cập dữ liệu của không gian làm việc khác.",
        "Bạn phải có quyền hợp pháp đối với dữ liệu khách hàng bạn nhập và tuân thủ quy định của Zalo, Telegram, Google và ngân hàng.",
      ],
    },
    { id: "content", title: "5. Nội dung của khách hàng", paragraphs: ["Bạn giữ quyền sở hữu dữ liệu và tài liệu bạn đưa vào NIVO. Bạn cấp cho chúng tôi quyền hạn chế để lưu trữ và xử lý chúng nhằm cung cấp dịch vụ, theo Chính sách quyền riêng tư."] },
    { id: "ai", title: "6. Kết quả do AI tạo ra", paragraphs: ["AI có thể sai hoặc thiếu sót. Hãy xem lại kết quả trước khi dựa vào hoặc gửi cho khách hàng, nhất là các nội dung về tiền, hợp đồng và pháp lý. Bạn chịu trách nhiệm về quyết định dựa trên kết quả đó."] },
    { id: "availability", title: "7. Tình trạng dịch vụ", paragraphs: ["Chúng tôi cố gắng giữ dịch vụ hoạt động ổn định nhưng không cam kết không gián đoạn. Dịch vụ phụ thuộc vào bên thứ ba (Zalo, Telegram, SePay, Google, nhà cung cấp AI) có thể thay đổi hoặc gặp sự cố."] },
    { id: "termination", title: "8. Chấm dứt", paragraphs: ["Bạn có thể ngừng dùng và yêu cầu xóa tài khoản bất kỳ lúc nào. Chúng tôi có thể tạm ngưng hoặc chấm dứt tài khoản vi phạm điều khoản này. Credit chưa dùng không được hoàn lại, trừ khi pháp luật quy định khác. (TODO: xác nhận chính sách hoàn tiền.)"] },
    { id: "liability", title: "9. Giới hạn trách nhiệm", paragraphs: ["Trong phạm vi pháp luật cho phép, dịch vụ được cung cấp ở trạng thái hiện có, và NIVO không chịu trách nhiệm về thiệt hại gián tiếp hay mất lợi nhuận. Trách nhiệm tối đa của NIVO không vượt quá số tiền bạn đã trả trong 12 tháng gần nhất. (TODO: luật sư xác nhận.)"] },
    { id: "law", title: "10. Luật áp dụng", paragraphs: ["Điều khoản này tuân theo pháp luật Việt Nam. Tranh chấp được giải quyết thương lượng trước, nếu không được thì tại tòa án có thẩm quyền của Việt Nam."] },
    { id: "contact", title: "11. Liên hệ", paragraphs: ["Gửi câu hỏi tới support@nivo.vn. (TODO: chủ sở hữu xác nhận hộp thư.)"] },
  ],
};

const en: LegalDoc = {
  title: "Terms of Service",
  draft: "Draft - last updated 12/10/2026",
  intro: "By creating an account or using NIVO OS at nivo.vn, you agree to the terms below.",
  sections: [
    { id: "service", title: "1. The service", paragraphs: ["NIVO OS is software that helps small businesses manage customers, messages, payments and tasks, with AI assistance. Features may change over time."] },
    { id: "accounts", title: "2. Accounts and workspaces", paragraphs: ["You must give accurate information and keep your sign-in details secret. The workspace owner is responsible for the members they invite and the connections (Zalo OA, Telegram, SePay, Google) they configure."] },
    {
      id: "plans",
      title: "3. Plans and AI credits",
      items: [
        "Each plan includes a monthly AI credit allowance. (TODO: confirm whether monthly credits roll over.)",
        "When the monthly credits run out you can buy top-up packs. Top-up credits are valid for 12 months from purchase.",
        "Payment is by bank transfer through a VietQR code handled by SePay. An order is confirmed when a transfer with the right amount and reference is received.",
      ],
    },
    {
      id: "use",
      title: "4. Acceptable use",
      items: [
        "Do not use NIVO to send spam, to defraud, or to publish unlawful content.",
        "Do not break into or overload the system, or access another workspace's data.",
        "You must have the legal right to the customer data you enter, and follow the rules of Zalo, Telegram, Google and your bank.",
      ],
    },
    { id: "content", title: "5. Customer content", paragraphs: ["You keep ownership of the data and documents you put into NIVO. You give us a limited right to store and process them to provide the service, as described in the Privacy Policy."] },
    { id: "ai", title: "6. AI output", paragraphs: ["AI can be wrong or incomplete. Review its output before you rely on it or send it to a customer, especially anything about money, contracts or legal matters. You are responsible for decisions made on that output."] },
    { id: "availability", title: "7. Availability", paragraphs: ["We work to keep the service running but do not promise it will be uninterrupted. The service depends on third parties (Zalo, Telegram, SePay, Google, AI providers) that may change or fail."] },
    { id: "termination", title: "8. Termination", paragraphs: ["You may stop using NIVO and ask us to delete your account at any time. We may suspend or end an account that breaks these terms. Unused credits are not refunded unless the law requires it. (TODO: confirm refund policy.)"] },
    { id: "liability", title: "9. Limits of liability", paragraphs: ["To the extent the law allows, the service is provided as is, and NIVO is not liable for indirect loss or lost profit. NIVO's total liability is capped at the amount you paid in the last 12 months. (TODO: lawyer to confirm.)"] },
    { id: "law", title: "10. Governing law", paragraphs: ["These terms are governed by the law of Vietnam. Disputes are first settled by negotiation, and otherwise by the competent courts of Vietnam."] },
    { id: "contact", title: "11. Contact", paragraphs: ["Send questions to support@nivo.vn. (TODO: owner to confirm the mailbox.)"] },
  ],
};

export const termsDoc = (locale: Locale): LegalDoc => (locale === "en" ? en : vi);
