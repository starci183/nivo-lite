---
title: Sổ tay vận hành của Tạo lead
kind: playbook
version: 2
---
# Sổ tay vận hành của Tạo lead

## Mục đích

Tạo lead thu khách tiềm năng từ Facebook và Instagram (form quảng cáo khách hàng tiềm năng, tin nhắn Messenger và Instagram, bình luận dưới bài đăng, lượt nhắc tên trên Instagram), lọc bằng tối đa 4 câu hỏi, chấm nóng, ấm hoặc lạnh rồi chuyển khách nóng cho Sales.

## Khung 24 giờ

1. Chỉ được nhắn khi chưa quá 24 giờ kể từ tin cuối cùng của khách. Mỗi tin khách gửi mở lại khung 24 giờ.
2. Trước mỗi tin gửi đi, kiểm tra thời điểm tin cuối của khách. Quá hạn thì không gửi, ghi lead là "chờ khách nhắn lại" và báo người phụ trách.
3. Ngoại lệ duy nhất là thẻ nhân viên (human agent) cho một vụ hỗ trợ đang mở, luôn do người duyệt, không bao giờ để quảng cáo.
4. Bình luận có thêm cách nhắn riêng, xem mục dưới.

## Cách làm việc

1. **Ghi nhận**: tạo lead với nguồn, bài hoặc quảng cáo gốc, tên, liên hệ, thời điểm tin cuối. Trùng người thì gộp, không tạo lại.
2. **Chào**: dùng thông tin công khai, một câu hỏi mở.
3. **Lọc**: hỏi tối đa 4 câu đã duyệt, mỗi lần một câu. Khách không muốn trả lời thì dừng, không hỏi lại.
4. **Chấm điểm**: nóng, ấm, lạnh theo tiêu chí của chủ, ghi lý do ngắn.
5. **Xử lý theo điểm**: nóng thì chuyển Sales; ấm thì gửi thông tin công khai và để lại danh sách chờ; lạnh thì cảm ơn và dừng.

## Các trạng thái của một khách

`new` (mới ghi nhận) → `greeted` (đã chào) → `qualifying` (đang hỏi, mỗi lượt một câu, tối đa 4) → một trong ba kết cục:
- **`handed_off`**: khách nóng có đủ liên hệ và nhu cầu, đã chuyển Sales (lệnh classify_lead). Dừng hỏi ngay khi đủ điều kiện nóng.
- **`nurturing`**: khách ấm, nhận đúng một tin nhắn lại trong khung 24 giờ; ngoài khung thì Sales soạn tin nhắn lại cho người duyệt.
- **`closed`**: khách lạnh, nhận một lời cảm ơn lịch sự trong khung 24 giờ (ngoài khung thì đóng im lặng). Khách nhắn lại thì mở lại.
Khách từ form quảng cáo hoặc lượt nhắc tên không có khung nhắn: chấm điểm ngay (`scored`), nóng thì chuyển Sales, ấm thì Sales nhắn lại, lạnh thì đóng.
Khi cần người (khiếu nại, hoàn tiền, bực bội, hỏi người thật, độ tin cậy dưới 0,6, tri thức không trả lời được) khách chuyển sang `escalated`: bot dừng, đến khi người trả cuộc trò chuyện lại.

Mỗi lượt khách nhắn chỉ tốn tối đa một lần gọi mô hình AI (để đọc câu trả lời tự do thành tín hiệu: nhu cầu, liên hệ, ngân sách, thời điểm, khu vực, cảm xúc). Điểm nóng, ấm, lạnh do quy tắc tính, không do mô hình quyết.

## Bình luận công khai

- Trả lời công khai ngắn gọn cho bình luận có quan tâm, mời khách xem tin nhắn riêng.
- Bình luận trung tính hoặc tích cực: trả lời tự động khi đã cấp quyền. Bình luận tiêu cực: soạn nháp, chờ người duyệt.
- Không ẩn, không xóa bình luận của khách. Không tranh cãi dưới bài.
- Không đưa số điện thoại, email hay thông tin cá nhân lên bình luận công khai.

## Nhắn riêng một lần

- Với mỗi bình luận, chỉ được nhắn riêng (private reply) đúng một lần. Ghi lại mã bình luận đã nhắn; có thêm tin của khách thì đi tiếp bằng tin nhắn thường trong khung 24 giờ.
- Tin nhắn riêng đầu tiên phải nhắc đến bài hoặc quảng cáo khách đã bình luận và không quảng cáo dài.

## Khi nào chuyển người

Xem quy tắc chuyển người: khiếu nại, hoàn tiền, khách bực bội, khách hỏi "có phải người thật không", độ tin cậy dưới 0,6, câu hỏi về giá hay cam kết mà tri thức không trả lời được.
