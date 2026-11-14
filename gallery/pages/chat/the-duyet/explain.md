---
title: Trò chuyện / Thẻ xin duyệt (approval.decision mở rộng)
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Thẻ `approval.decision` trong phòng của agent hoặc phòng chung: engine đăng TRƯỚC khi một bước ghi (chế độ `ask`) chạy. Bản vẽ đã duyệt: `lanes/drawings/chat-approval-card-20261113.html` (thẻ 1; thẻ 2 là thẻ dừng, xem `chat/chatbot-the-dung`). Không có ảnh: chưa chạy được web (phase 2 chụp). Mọi chữ trong thẻ ngoài các chữ của web (nút, tên dòng, nếp gấp) là do engine gửi từ dữ liệu thật của cuộc gọi.

## Đầu thẻ "Cần thầy duyệt · <tên bước>"
Vì sao: người duyệt thấy ngay bước nào xin, không phải đọc hết thẻ. Dòng "approval.decision · 10:13" mờ ở góc phải đầu thẻ trong bản vẽ là ghi chú (mã kind), không vẽ: giờ nằm ở dòng meta mờ dưới thẻ. Tiêu đề ghép ở web từ `payload.step.title`; thẻ cũ không có `step` giữ tiêu đề cũ "Cần bạn duyệt". Chip bên phải = trạng thái ("Chờ duyệt" / "Đã duyệt" / "Đã từ chối" / "Đã hết hạn").
Luật: `chat-surfaces` (thẻ của người khác = bề mặt trắng phẳng trên nền), `badge-dot-or-not` (chip không chấm: đây là kết quả), `type-scale-14-12`.
Grammar: `MessageCard` `title` `chip` `author` `meta` qua `AgentMessageCard` (blocks-core).

## Lời tóm tắt của AI
Vì sao: một hai câu nói thẻ này xin gì và vì sao, từ mô tả của bước + tham số + ngữ cảnh; nếu AI lỗi thì là câu dự phòng của engine.
Luật: `type-scale-14-12`. Grammar: `Text size="sm"` trong `Stack gap="row"`.

## Danh sách có viền: Bước · Thao tác · số tiền và tham số
Vì sao: người duyệt cần đọc SỰ THẬT của cuộc gọi (số tiền, người nhận) chứ không chỉ lời AI. Dòng "Bước" = tên bước · mô tả bước ("Hoàn tiền · hoàn cho khách khi đơn đã trả bị huỷ"). Dòng "Thao tác" đứng ngay sau "Bước", theo bản vẽ: tên thao tác bằng lời theo ngôn ngữ người xem (`call.label` do engine gửi, lấy từ tiêu đề công cụ trong manifest, vi / en) rồi " · " tài khoản ("Huỷ link thanh toán · payOS Tiệm hoa"); tài khoản nằm CHUNG dòng này, không lặp lại thành dòng riêng. Khi không có `call.label` (engine chưa gửi, hoặc nhãn sai dạng) thì KHÔNG có dòng "Thao tác" và tài khoản (nếu có) giữ dòng riêng "Tài khoản"; mã công cụ không bao giờ được vẽ thành nội dung, nó chỉ nằm ở nếp gấp kỹ thuật. Lưu ý: dòng chỉ bật khi schema payload của SDK có `call.label` (hiện zod bỏ phần thừa). Mỗi dòng tên + giá trị; số tiền đã được engine ghi bằng chữ kèm đơn vị; giá trị dài xuống dòng, không tràn ở 390.
Luật: `stop-card-design` + `surfacecard-select-subtitle` (list trong thẻ có viền, không thẻ trong thẻ), `row-control-clearance` (p-4 mép thẻ, p-3 tới vạch).
Grammar: `SurfaceCard kind="list" layout="keyValue"`.

## Xem trước (preview) của gói
Vì sao: một gói có thể vẽ bản xem trước của việc sắp làm (thư nháp, bản nháp tin nhắn…). Thẻ hỏi bộ view đã đăng ký của gói theo `preview.kind`; kind lạ, kind lõi, hoặc dữ liệu không đúng schema của kind thì KHÔNG vẽ gì và thẻ vẫn dùng được. Web không vẽ gì thay cho gói.
Vị trí: sau danh sách có viền, trước nếp gấp. Khung của xem trước do gói tự vẽ (bản vẽ minh hoạ một danh sách có viền nền nhạt); lõi không bọc thêm khung, nên không có thẻ trong thẻ và không để lại vùng trống khi không có preview.
Luật: `nivo-compose-architecture` (gói tự vẽ phần của mình), `blocks-are-real-code`.
Grammar: view của kind trong `agentMessageViews` (blocks-core `client/agent-message`); `previewViewOf` quyết định.

## Nếp gấp "Chi tiết kỹ thuật"
Vì sao: mã công cụ ("Thao tác"), mã bước ("Mã bước"), các fact `technical` (mã lỗi, id) là của kỹ sư, không phải nội dung; gấp mặc định, không bao giờ nằm ở danh sách chính.
Luật: bản vẽ `stop-card.html` ("Chi tiết" mở các facts thô, mặc định đóng), `stop-card-design`. Grammar: `Disclosure kind="quiet"` (tự có dấu mở/đóng, không gõ ký tự).

## Hai nút "Từ chối" (trung tính) + "Duyệt" (đỏ duy nhất)
Vì sao: chỉ một CTA đỏ trong thẻ. Chỉ người quyết được (`approval.canDecide`: chủ / quản lý được phép) thấy nút; người khác thấy thẻ chỉ đọc với chip "Chờ duyệt". Bấm đi qua mutation sẵn `decideChatApproval` (không thêm thao tác be).
Thứ tự: bản vẽ để "Từ chối" rồi "Duyệt" căn phải; Grammar `MessageCard` tự sắp hàng nút (primary đứng đầu, neutral sau), luật của Grammar thắng nên "Duyệt" đứng trước. Nút `sm` không icon.
Luật: `red-budget-links-foreground`, `page-header-left-sublabel-xs` (nút sm không icon). Grammar: `MessageCard actions` (primary + secondary).

## Sau khi quyết: viết lại tại chỗ
Vì sao: thẻ không còn nút; chip đổi, dòng muted cuối thẻ nói ai quyết và lúc nào ("Đã duyệt bởi Lan 17:21"). Thẻ vẫn một cái, không đăng thẻ thứ hai.
Luật: `stop-card-design` (in-place rewrite, only needs-controls).

## Ảnh còn thiếu (shots missing), mỗi ảnh cần dữ liệu gì
Dev hiện KHÔNG có sẵn thẻ xin duyệt có `step/call/facts`: cần fixture (tin nhắn agent `approval.decision` với payload đầy đủ), hoặc một lần chạy thật chặn ở bước `ask` sau khi engine mới đăng thẻ.
1. Chờ duyệt, người quyết (chủ): payload đầy đủ, `approval.status = pending`, `canDecide = true`; thấy 2 nút.
2. Chờ duyệt, người không quyết: cùng thẻ, `canDecide = false`; không nút, chip "Chờ duyệt".
3. Đã duyệt: `status = approved` + `decidedByName` + `decidedAt`.
4. Đã từ chối: `status = refused`.
5. Có preview: `preview = { kind: <kind một gói đã đăng ký view>, payload hợp lệ }`. Hiện chưa gói nào đăng ký kind preview, nên cần fixture kind thử hoặc đợi gói đầu tiên.
6. Preview kind lạ: `preview.kind = "x.unknown"`; thẻ không có vùng xem trước.
7. 390 px với giá trị dài (người nhận, số tiền).
8. Đã duyệt / đã từ chối với giá trị dài ở 390 px: dòng "Đã duyệt bởi <tên> <giờ>" xuống dòng, không tràn.
