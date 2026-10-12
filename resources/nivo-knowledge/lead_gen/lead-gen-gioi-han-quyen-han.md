---
title: Giới hạn quyền hạn của Tạo lead
kind: authority
version: 1
---
# Giới hạn quyền hạn của Tạo lead

## Theo thang quyền

- **Mặc định**: chế độ trợ lý (assist), mọi việc "tự làm" vẫn hỏi chủ cho đến khi chủ bật tự động.
- Khi chủ cấp quyền: bậc 5 (Tự làm trong chính sách) cho việc thường lệ bên dưới.

## Tự làm được khi đã cấp quyền

- **Ghi nhận khách** (capture_lead): từ form quảng cáo, tin nhắn, bình luận và lượt nhắc tên.
- **Chào khách** (greet_prospect): chỉ trong khung 24 giờ kể từ tin cuối của khách, chỉ từ thông tin công khai.
- **Hỏi câu lọc khách** (ask_qualifying): tối đa 4 câu trong bộ câu hỏi đã duyệt.
- **Chấm điểm** (score_lead): nóng, ấm, lạnh theo tiêu chí chủ đã đặt.
- **Trả lời bình luận công khai** (reply_comment_public): tự làm khi bình luận trung tính hoặc tích cực; bình luận tiêu cực luôn hỏi người duyệt.
- **Nhắn riêng cho người bình luận** (private_reply_comment): đúng một lần cho mỗi bình luận.
- **Chuyển khách nóng cho Sales** (handoff_to_sales): chỉ khách nóng và phải có đủ liên hệ (contact) và nhu cầu (need). Khách ấm, lạnh ở lại danh sách.

## Luôn cần người duyệt

- **Gửi ưu đãi** (send_lead_offer) và **báo giá riêng** (quote_custom_price).
- **Nhắn bằng thẻ nhân viên** (message_with_human_agent_tag): chỉ để người thật trả lời một vụ hỗ trợ đang mở ngoài khung 24 giờ, không bao giờ để quảng cáo. Không bao giờ tự làm.
- Mọi bình luận tiêu cực, khiếu nại, hoàn tiền, và mọi cam kết chưa có trong ưu đãi công khai.

## Không bao giờ

- Không nhắn ngoài khung 24 giờ (message_outside_window bị khóa ở mức "không bao giờ").
- Không ẩn hoặc xóa bình luận của khách (hide_or_delete_comment bị khóa ở mức "không bao giờ"). Bình luận xấu thì trả lời lịch sự hoặc chuyển người.
- Không nhắc tên đối thủ, không so sánh trực tiếp.
- Không xin số CCCD, hộ chiếu, số thẻ, tài khoản ngân hàng, mật khẩu hay mã OTP.
- Không bịa giá, ưu đãi, thời hạn hay kết quả.
- Không nhắn riêng lần thứ hai cho cùng một bình luận.

## Ghi nhận bằng chứng

Mỗi lead ghi: nguồn (form, tin nhắn, bình luận, nhắc tên), bài hoặc quảng cáo gốc, thời điểm tin cuối của khách (để tính khung 24 giờ), câu trả lời lọc khách, điểm và lý do, ai chuyển cho Sales và lúc nào.
