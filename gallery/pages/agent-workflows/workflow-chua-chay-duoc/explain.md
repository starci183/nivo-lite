---
title: Workflow chưa chạy được (thẻ lý do trên tab Workflows)
route: /workspaces/<ws>/agents/<module>/<installation>/workflows
area: agent-workflows
---
# Thẻ "Chưa chạy được" trên tab Workflows

Một workflow bị ẨN khi không trigger nào bắn được hoặc bước chặn không có provider phục vụ (`templates.md` luật 8, `triggers.md` luật 2 và 6). `agentWorkflows` trả `readiness { hidden, waitingFor, blocked[{ provider, reason, stream, connectionIds }] }`; trang nói vì sao, mỗi lý do một hàng với đúng MỘT bước tiếp theo. Không có workflow bị ẩn thì không vẽ thẻ.

## Thẻ danh sách trung tính phía trên bảng workflow
Vì sao: một thông tin giải thích là trung tính, không bao giờ đỏ (ngân sách đỏ: một nút chính + link trong văn). Mỗi hàng: tên workflow, dưới nó lý do bằng lời, cuối hàng một nút trung tính cỡ sm (không icon).
Luật: `red-budget-links-foreground`, `suggestion-button-sm`, `pink-page-surface-rule`, `row-control-clearance`.
Grammar: `SurfaceCard kind="list"` (`label`, `count`, `ListRowData.action intent="neutral"`, `actionPlacement="end"`).

## Bốn lý do (API cho `reason` dạng chữ; một lý do lạ vẫn có hàng)
- `not_connected`: "Chờ kết nối <provider>" → nút "Kết nối <provider>" mở trang Kết nối.
- `trigger_off`: "Trigger của <provider> đang tắt; bật ở trang kết nối" → nút "Bật trigger" mở trang Kết nối (tab Trigger của tài khoản).
- `needs_pick`: hai tài khoản cùng đọc một luồng → nút "Chọn tài khoản" mở ngăn chọn (dưới). Khi `stream` rỗng (nhiều tài khoản cho một bước) nút "Mở sơ đồ" dẫn tới bản đồ workflow, nơi bước chọn tài khoản.
- `tool_unavailable`: "<công cụ>: chưa có tài khoản <provider> nào đang nối phục vụ công cụ này" → nút "Xem kết nối". Tên công cụ lấy theo nhãn từ vựng blocks-core; câu chung "Một công cụ của bước" khi API chưa gửi tên.
- Lý do lạ: "Đang chờ <provider>" → "Xem kết nối".
Một workflow ẩn mà `blocked` rỗng vẫn nói chờ provider nào (`waitingFor`, như "chưa kết nối").

## Ngăn "Chọn tài khoản nguồn" (needs_pick)
Vì sao: lựa chọn ngắn nên là ngăn như ngăn "Tạo workflow" bên cạnh, không phải trang mới. Mỗi lựa chọn là `SurfaceCard kind="select"` (hàng Checkbox, kẻ ngang suốt thẻ; chọn một vẫn dùng kiểu checkbox); dòng phụ của hàng là luồng bị tranh (`bank-account:…`). Một nút chính duy nhất "Dùng tài khoản này" lưu lựa chọn (`agreeAgentNodeRights` với `triggerPicks`); tài khoản còn lại không đánh thức workflow này. Chỉ chủ workspace lưu được (máy chủ từ chối người khác): với quản lý nút "Chọn tài khoản" mờ đi.
Luật: `surfacecard-select-subtitle`, `complex-content-page-not-drawer` (ngăn chỉ cho form ngắn).
Grammar: `Drawer` (`description`, `footer`), `SurfaceCard kind="select" selectionMode="single"`, `Button intent="commit"`.

## Thiếu cho đến khi máy chủ gửi thêm
`AgentWorkflowReadinessBlockType` chưa có `verb` (cần cho `triggerPicks[].verb`) và `tool` (tên công cụ của `tool_unavailable`): khi chưa có `verb` hàng `needs_pick` có luồng nhưng không có nút chọn; chưa có `tool` thì câu chung được dùng.

Shots missing: thẻ với bốn lý do, ngăn chọn (1440 và 390), hàng chọn mờ với quản lý.
