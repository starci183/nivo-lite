---
title: Trò chuyện / Thẻ "Đề nghị sửa Second Brain"
route: /workspaces/<ws>/chat?room=<id>
area: chat
---
Route `/workspaces/<ws>/chat?room=<id>`, phòng riêng với một agent. Bản vẽ: `truth-graph-flows.png` vùng C và `truth-change-and-critique.png` phần A. Các thẻ trong shot là DỮ LIỆU GIẢ (mocked: dev chưa có thẻ `brain.change` nào đủ trạng thái); chỉ phòng, tên và khung là thật. Thẻ typed `brain.change` do `ChatMessageType.brainChange` mang, web tự ghép chữ (tiêu đề, chip, nút), backend chỉ gửi giá trị và cờ của người xem.

## Thẻ đang chờ quyết (chủ tiệm xem): tiêu đề, chip "Cần bạn quyết", khóa sự thật
Vì sao: một thẻ cho một đề nghị, phẳng và trắng như mọi thẻ của agent trong chat (không bóng, không viền); tiêu đề theo loại ("sửa" / "thêm vào" / "bỏ khỏi" Second Brain), chip Badge KHÔNG chấm vì đây là nhãn kết quả chứ không phải trạng thái đang chạy; dòng khóa "Giao hàng · Phí ship nội thành" cho biết đề nghị nói về sự thật nào.
Luật: `chat-surfaces`, `badge-dot-or-not`, `type-scale-14-12`.
Grammar: `MessageCard` `title` `chip` `meta` `measure="wide"` (`composite/MessageCard/index.d.ts`) trong composite `TeamChatBrainChangeCard`; `Badge tone="accent"`.

## Danh sách có viền: "Hiện tại" (gạch ngang) và "Đề nghị"
Vì sao: surface trong surface — mọi danh sách bên trong một thẻ là danh sách có viền bo tròn và vạch kẻ ngang, không phải hộp xám. Hàng "Hiện tại" gạch ngang giá trị đang dùng vì giá trị đề nghị sẽ thay nó, kèm dòng 12 muted "bản N · nguồn"; hàng "Đề nghị" in đậm giá trị mới và nguồn lời (ai nói, lúc nào).
Luật: `stop-card-design`, `row-control-clearance`, `type-scale-14-12`.
Grammar: `SurfaceCard kind="list" layout="keyValue"` (`core/surfaceCardData.d.ts`, `ListRowData.value`); `Text isSuperseded` / `isStrong` (`leaf/Text/index.d.ts`).

## Biến thể "Sẽ áp dụng từ dd/MM"
Vì sao: khi giá trị hiện tại là một KẾ HOẠCH chưa có hiệu lực (`current.startsAt`), nhãn đổi thành "Sẽ áp dụng từ 12/11" (ngày theo giờ tiệm, Asia/Ho_Chi_Minh) và giá trị không bị gạch, vì nó chưa là giá trị đang dùng.
Luật: `type-scale-14-12`, TRUTH-READS item 2 (D-BR-6).
Grammar: như hàng "Hiện tại"; code `modules/teamChat/brainChange.ts` (`currentRowOf`).

## Biến thể "Có thể thay cho" và nút "Giữ cả hai"
Vì sao: khi sự thật gần nghĩa với một sự thật khác (`current.match = near`), hàng đầu nói đúng điều đó ("Có thể thay cho" + khóa của sự thật kia) và chủ tiệm có thêm "Giữ cả hai" (cờ `canKeepBoth`).
Luật: `suggestion-button-sm` (lựa chọn là nút trung tính), FX5 request.
Grammar: `MessageCard actions` (`kind: "neutral"`).

## "Lý do:" và các lời dẫn chứng (thẻ tự học)
Vì sao: lý do là lời của agent, một dòng "Lý do:" muted rồi nội dung; khi có nhiều dẫn chứng (tự học) mỗi lời là một hàng trong danh sách có viền: câu trích và "người nói · dd/MM HH:mm" 12 muted.
Luật: `stop-card-design`, `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` `description` (`core/surfaceCardData.d.ts`); `Text size="xs" tone="muted"`.

## Hàng nút: "Đồng ý" (đỏ duy nhất), "Không", "Giữ cả hai"
Vì sao: chỉ hiện nút người xem được bấm (`canApprove` chỉ chủ tiệm, `canReject` chủ tiệm và quản lý); "Đồng ý" là CTA đỏ DUY NHẤT của thẻ, các nút còn lại trung tính. Bản vẽ có thêm "Chi tiết ›" ở cuối hàng: chưa dựng vì thẻ không có nơi để mở (không có trang chi tiết đề nghị); cần chủ quyết.
Luật: `red-budget-links-foreground`, `suggestion-button-sm`.
Grammar: `MessageCard actions` (`kind: "primary" | "neutral"`).

## Thẻ đã xử lý: "Giao hàng · Phí ship nội thành: 20.000 đ → 30.000 đ" và dấu vết
Vì sao: sau quyết định thẻ được viết lại tại chỗ (cùng message, revision tăng): chip "Đã đồng ý", dòng khóa có "cũ → mới", không còn nút, và một hàng dấu vết "Đã bấm Đồng ý" + "tên · giờ". Thẻ bị từ chối giữ danh sách và có dấu vết "Đã bấm Không"; thẻ bị đề nghị mới hơn thay hiện chip "Đã thay" và một dòng 12 muted.
Luật: `stop-card-design` (viết lại tại chỗ, dấu vết), `chat-surfaces`.
Grammar: `SurfaceCard kind="list"` một hàng; `MessageCard`.

## Dòng meta dưới thẻ ("Sales · từ chat · 17:40")
Vì sao: ai đề nghị, từ đâu (chat / tự học / tài liệu) và lúc nào, 12 muted dưới thẻ. Bản vẽ ghi cả "với khách Lan": backend chưa gửi tên phòng/khách nên chỉ ghi nguồn.
Luật: `type-scale-14-12`.
Grammar: `MessageCard meta` (`composite/MessageCard/index.d.ts`).
