---
title: Bảng câu hỏi thiết lập Chatbot
kind: setup_checklist
version: 1
---
# Bảng câu hỏi thiết lập Chatbot

Chatbot chỉ nên bật chạy thật khi các mục dưới đây đã có thông tin được chủ xác nhận. Mỗi mục tương ứng một "cổng" trong màn hình Thiết lập. Hỏi từng mục một, ghi nhận câu trả lời, và nếu thông tin đã có sẵn trong mục Tri thức doanh nghiệp thì đừng hỏi lại: hãy tóm tắt và nhờ chủ xác nhận.

## identity — Thông tin doanh nghiệp
Cần có: tên doanh nghiệp, làm nghề gì, phục vụ nhóm khách nào, địa điểm hoặc khu vực phục vụ.
Câu hỏi gợi ý: "Bạn giới thiệu giúp mình về doanh nghiệp: tên, bạn làm nghề gì và khách của bạn là ai?"
Đủ khi: có tên, loại hình dịch vụ hoặc sản phẩm, và ít nhất một điểm nhận diện khách hàng hoặc khu vực.

## products — Sản phẩm, dịch vụ và giá (nếu có bán cho khách)
Áp dụng khi doanh nghiệp có bán hoặc cung cấp thứ gì đó cho khách. Nếu chủ nói không bán trực tiếp, không có bảng giá hoặc chỉ dùng NIVO nội bộ, ghi nhận "không áp dụng" và xem mục này là đã đủ, không hỏi lại.
Cần có (khi áp dụng): các sản phẩm hoặc dịch vụ chính, giá hoặc cách báo giá, các khoản phát sinh.
Gợi ý: nếu danh sách dài, đề nghị chủ thêm thành một nguồn trong mục Tri thức (đặt chủ đề tùy ý, ví dụ "Dịch vụ") thay vì gõ trong chat.
Đủ khi: có các mục chính kèm giá hoặc quy tắc tính giá rõ ràng, hoặc chủ xác nhận không áp dụng. Không điền giá thay chủ.

## support_scope — Phạm vi hỗ trợ
Cần có: Chatbot được trả lời nhóm câu hỏi nào, nhóm nào để nhân viên lo, chủ đề cấm.
Đủ khi: có danh sách "được trả lời" và danh sách "không trả lời" hoặc chuyển người.

## channels — Kênh tiếp nhận
Cần có: khách nhắn qua đâu (website, Telegram, Zalo, Facebook...), kênh nào bật trước.
Đủ khi: có ít nhất một kênh và biết kênh đó đã kết nối hay chưa.

## hours_sla — Giờ làm việc và thời gian phản hồi
Cần có: giờ mở cửa, ngày nghỉ, bao lâu thì người thật phản hồi một câu chuyển người.
Đủ khi: có khung giờ cụ thể và cam kết thời gian phản hồi mà chủ chấp nhận.

## handoff — Khi nào chuyển cho người
Cần có: tình huống phải chuyển, người nhận (tên hoặc vai trò), kênh liên lạc nội bộ.
Đủ khi: có ít nhất ba tình huống và một người nhận cụ thể.

## prohibited — Điều không được hứa
Cần có: các cam kết bot tuyệt đối không tự đưa ra (giá riêng, giảm giá, bảo hành, hoàn tiền, thời hạn).
Đủ khi: chủ đã liệt kê hoặc xác nhận bộ giới hạn mặc định của NIVO là đủ.

## tone — Giọng điệu
Cần có: cách xưng hô với khách, mức trang trọng, có dùng emoji không, cụm từ nên hoặc không nên dùng.
Đủ khi: có cách xưng hô và một mô tả phong cách (hoặc ví dụ một câu trả lời mẫu mà chủ thích).

## Mục không áp dụng

Không phải doanh nghiệp nào cũng có đủ mọi mục. Khi chủ nói rõ một mục không áp dụng ("bên mình không có bảng giá", "chưa dùng Zalo"), agent ghi nhận lý do ngắn gọn, coi mục đó là đã được trả lời, và không hỏi lại. Chỉ nhắc lại nếu chủ đổi ý.

## Cách hỏi trong chat thiết lập

- Mỗi lượt chỉ hỏi một mục chưa đủ, ưu tiên mục chặn nhiều việc nhất (products, support_scope).
- Sau mỗi câu trả lời: xác nhận ngắn, ghi lại, rồi chuyển sang mục kế.
- Nếu câu trả lời dài (bảng giá, chính sách đổi trả), gợi ý thêm tài liệu vào Tri thức.
- Khi mọi mục đã có thông tin, nhắc chủ rà lại bên phải rồi bấm "Áp dụng".
