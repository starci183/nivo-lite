import type { Locale } from "@/i18n/core";
import type { LegalDoc } from "./types";

/* TODO(owner/lawyer): DRAFT. Approve the wording, confirm the contact mailbox, the retention periods and the company's registered details before launch. */

const vi: LegalDoc = {
  title: "Chính sách quyền riêng tư",
  draft: "Bản nháp - cập nhật lần cuối 12/10/2026",
  intro: "Chính sách này giải thích NIVO OS thu thập, sử dụng và bảo vệ dữ liệu của bạn như thế nào khi bạn dùng dịch vụ tại nivo.vn.",
  sections: [
    {
      id: "who",
      title: "1. Chúng tôi là ai",
      paragraphs: [
        "NIVO OS (nivo.vn) do đội ngũ NIVO vận hành. Câu hỏi về quyền riêng tư xin gửi tới support@nivo.vn.",
      ],
    },
    {
      id: "collect",
      title: "2. Dữ liệu chúng tôi thu thập",
      items: [
        "Tài khoản: email, tên hiển thị và thông tin đăng nhập qua Google hoặc email và mật khẩu.",
        "Dữ liệu không gian làm việc do bạn và nhóm của bạn nhập: khách hàng, đơn hàng, lịch hẹn, ghi chú, cấu hình tự động hóa.",
        "Tin nhắn từ các kênh bạn kết nối (Zalo OA, Telegram), gồm nội dung và thông tin người gửi mà kênh cung cấp.",
        "Thông báo thanh toán từ SePay khi bạn kết nối tài khoản ngân hàng: số tiền, nội dung chuyển khoản, thời điểm.",
        "Tài liệu bạn thêm vào Second Brain (tệp tải lên, liên kết, văn bản dán, tệp chọn từ Google Drive).",
        "Số liệu sử dụng AI (số lần gọi, lượng token, chi phí) để tính credit AI.",
      ],
    },
    {
      id: "use",
      title: "3. Cách chúng tôi sử dụng dữ liệu",
      items: [
        "Cung cấp và vận hành dịch vụ: lưu dữ liệu, trả lời khách hàng, chạy tự động hóa, đối soát thanh toán.",
        "Tính credit AI và thanh toán gói dịch vụ.",
        "Bảo mật, chống lạm dụng và hỗ trợ khi bạn yêu cầu.",
      ],
      afterItems: ["Chúng tôi không bán dữ liệu của bạn và không dùng nó để quảng cáo."],
    },
    {
      id: "ai",
      title: "4. Xử lý bằng AI",
      paragraphs: [
        "Để tạo câu trả lời và đề xuất, nội dung liên quan được gửi tới các nhà cung cấp mô hình AI: OpenRouter để tạo embedding cho Second Brain, và hệ thống AI của NIVO để sinh nội dung. NIVO không dùng dữ liệu của bạn để huấn luyện mô hình.",
      ],
    },
    {
      id: "storage",
      title: "5. Lưu trữ và bảo mật",
      paragraphs: [
        "Dữ liệu được lưu trên Supabase và được kiểm soát truy cập theo từng không gian làm việc. Các khóa và token kết nối (Zalo, Telegram, Google, ngân hàng) được mã hóa bằng AES-256-GCM trước khi lưu. Không có hệ thống nào an toàn tuyệt đối; chúng tôi áp dụng các biện pháp hợp lý để giảm rủi ro.",
      ],
    },
    {
      id: "retention",
      title: "6. Thời gian lưu giữ và xóa dữ liệu",
      paragraphs: [
        "Chúng tôi giữ dữ liệu trong thời gian không gian làm việc còn hoạt động. Khi bạn yêu cầu xóa tài khoản hoặc không gian làm việc, chúng tôi xóa dữ liệu trong vòng 30 ngày, trừ phần pháp luật yêu cầu phải giữ (ví dụ chứng từ thanh toán). Ngắt kết nối một kênh hoặc tài khoản Google sẽ xóa token đã lưu của kết nối đó.",
      ],
    },
    {
      id: "rights",
      title: "7. Quyền của bạn",
      paragraphs: [
        "Bạn có quyền truy cập, chỉnh sửa, xuất, hạn chế xử lý và yêu cầu xóa dữ liệu cá nhân của mình, cũng như rút lại sự đồng ý đã cấp. Hãy gửi yêu cầu tới support@nivo.vn. Bạn chịu trách nhiệm có căn cứ hợp pháp để nhập dữ liệu của khách hàng của mình vào NIVO.",
      ],
    },
    {
      id: "cookies",
      title: "8. Cookie",
      paragraphs: [
        "NIVO chỉ dùng cookie thiết yếu: cookie phiên đăng nhập, cookie ghi nhớ ngôn ngữ và một cookie ngắn hạn kiểm tra quyền truy cập. Chúng tôi không dùng cookie quảng cáo hay theo dõi.",
      ],
    },
    {
      id: "google",
      title: "9. Dữ liệu Google / Google user data",
      paragraphs: [
        "NIVO truy cập Google Drive chỉ thông qua Google Picker, và chỉ với những tệp bạn chủ động chọn (phạm vi drive.file). NIVO cũng truy cập các Google Sheets bạn kết nối (phạm vi drive.file).",
        "NIVO đọc các tệp đó để thêm vào Second Brain của không gian làm việc và không làm gì khác với chúng.",
      ],
      items: [
        "NIVO không bán hay chuyển dữ liệu Google cho bên thứ ba, không dùng cho quảng cáo, và không dùng để huấn luyện các mô hình AI/ML tổng quát.",
        "Con người không đọc dữ liệu Google của bạn, trừ khi bạn đồng ý, vì lý do bảo mật hoặc để tuân thủ pháp luật.",
        "Token Google được lưu mã hóa. Bạn có thể thu hồi bất kỳ lúc nào bằng cách ngắt kết nối trong NIVO hoặc tại myaccount.google.com/permissions.",
      ],
      limitedUse: true,
    },
    {
      id: "changes",
      title: "10. Thay đổi và liên hệ",
      paragraphs: ["Chúng tôi sẽ cập nhật ngày ở đầu trang khi chính sách thay đổi. Liên hệ: support@nivo.vn."],
    },
  ],
};

const en: LegalDoc = {
  title: "Privacy Policy",
  draft: "Draft - last updated 12/10/2026",
  intro: "This policy explains how NIVO OS collects, uses and protects your data when you use the service at nivo.vn.",
  sections: [
    {
      id: "who",
      title: "1. Who we are",
      paragraphs: [
        "NIVO OS (nivo.vn) is operated by the NIVO team. Privacy questions go to support@nivo.vn.",
      ],
    },
    {
      id: "collect",
      title: "2. Data we collect",
      items: [
        "Account: email, display name and sign-in details through Google or email and password.",
        "Workspace data you and your team enter: customers, orders, bookings, notes, automation settings.",
        "Messages from the channels you connect (Zalo OA, Telegram), including the content and the sender details the channel provides.",
        "Payment notifications from SePay when you connect a bank account: amount, transfer description, time.",
        "Documents you add to the Second Brain (uploaded files, links, pasted text, files picked from Google Drive).",
        "AI usage metering (number of calls, tokens, cost) to calculate AI credits.",
      ],
    },
    {
      id: "use",
      title: "3. How we use data",
      items: [
        "To provide and run the service: store data, answer customers, run automations, reconcile payments.",
        "To meter AI credits and bill plans.",
        "For security, abuse prevention and support when you ask for it.",
      ],
      afterItems: ["We do not sell your data and do not use it for advertising."],
    },
    {
      id: "ai",
      title: "4. AI processing",
      paragraphs: [
        "To draft replies and suggestions, the relevant content is sent to AI model providers: OpenRouter for Second Brain embeddings, and NIVO's AI engine for generation. NIVO does not use your data to train models.",
      ],
    },
    {
      id: "storage",
      title: "5. Storage and security",
      paragraphs: [
        "Data is stored on Supabase with access controlled per workspace. Connection secrets and tokens (Zalo, Telegram, Google, bank) are encrypted with AES-256-GCM before they are stored. No system is perfectly secure; we apply reasonable measures to reduce risk.",
      ],
    },
    {
      id: "retention",
      title: "6. Retention and deletion",
      paragraphs: [
        "We keep data while the workspace is active. When you ask us to delete your account or workspace, we delete the data within 30 days, except what the law requires us to keep (for example payment records). Disconnecting a channel or a Google account removes that connection's stored token.",
      ],
    },
    {
      id: "rights",
      title: "7. Your rights",
      paragraphs: [
        "You may access, correct, export, restrict the processing of and ask us to delete your personal data, and withdraw consent you gave. Send requests to support@nivo.vn. You are responsible for having a lawful basis to enter your own customers' data into NIVO.",
      ],
    },
    {
      id: "cookies",
      title: "8. Cookies",
      paragraphs: [
        "NIVO uses essential cookies only: the sign-in session, the language preference and a short-lived access check. We use no advertising or tracking cookies.",
      ],
    },
    {
      id: "google",
      title: "9. Dữ liệu Google / Google user data",
      paragraphs: [
        "NIVO accesses Google Drive only through the Google Picker, and only for the files you explicitly select (scope drive.file). NIVO also accesses the Google Sheets you connect (scope drive.file).",
        "NIVO reads those files to add them to the workspace's Second Brain and does nothing else with them.",
      ],
      items: [
        "NIVO does not sell or transfer Google data to third parties, does not use it for ads, and does not use it to train generalized AI/ML models.",
        "Humans do not read your Google data, except with your consent, for security reasons or to comply with the law.",
        "Google tokens are stored encrypted. You can revoke access at any time by disconnecting in NIVO or at myaccount.google.com/permissions.",
      ],
      limitedUse: true,
    },
    {
      id: "changes",
      title: "10. Changes and contact",
      paragraphs: ["We will update the date at the top when this policy changes. Contact: support@nivo.vn."],
    },
  ],
};

export const privacyDoc = (locale: Locale): LegalDoc => (locale === "en" ? en : vi);

export const LIMITED_USE_NOTE_VI =
  "Nói cách khác: NIVO chỉ dùng dữ liệu nhận từ Google API để cung cấp tính năng bạn yêu cầu, và tuân thủ các yêu cầu Giới hạn sử dụng (Limited Use) trong Chính sách dữ liệu người dùng của Google API Services.";
