---
title: Công việc / Việc đang làm (Kế toán, rỗng)
route: /workspaces/<ws>/agents/<module>/<installation>/work
area: agent-work
---

Màn này được tách từ một thư mục gộp nhiều agent/trạng thái. Các vùng bên dưới được sao từ màn gốc; chỗ nào không đúng với ảnh thì ghi lại.
Shots: `1440.png` (Sales, có việc), `accounting-1440.png` / `chatbot-1440.png` (rỗng cả ba thẻ), `1920.png`, `390.png`, `before/`. Code: `fe/apps/web/src/components/blocks/AgentWorkPanes/component.tsx` + composites `AgentWork{Status,Schedule,Goals,Tasks,AddButton}` + `branches/AgentWorkRows`. Grammar d.ts nằm dưới `node_modules/@starci/grammar/dist/core/`. Ba agent dùng cùng một trang; khác biệt chỉ ở dữ liệu (Sales có 2 việc "care due", Kế toán và Chatbot rỗng). Lưu ý: shot 1440 của trang này chụp trước khi thêm tab Graph/Quy trình nên dải tab hơi khác bản hiện tại.

## Tab tầng 2 "Việc đang làm / Lượt chạy"
Vì sao: tầng tab thứ hai nằm trong dải trắng dưới tầng 1, cùng 14/40/500, gạch chân sát đường kẻ, căn trái, không nằm trên nền hồng. Hai tab đổi view bằng query `view`, không phải trang khác.
Luật: `page-header-left-sublabel-xs` (second tab layer), `surfacecard-zones-api` (secondary = underline).
Grammar: `Page` `header` `subTabs`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`; `Tabs`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`.

## Dòng trạng thái ("Sẵn sàng" + câu phụ)
Vì sao: một chip trạng thái có vòng rỗng (Badge isDot, đúng luật chấm rỗng) và tối đa hai dữ kiện (lượt chạy kế tiếp, hàng đợi) cạnh nó; khi agent dừng thì có Alert nêu lý do. Nó đứng trực tiếp trên nền hồng không thẻ vì là một dòng, không phải một khối nội dung ("một câu không thành thẻ"). Dữ kiện dùng `Text size="sm"`: `sm` bằng `md` = 14 theo `contexts/ui/components/text.md` (chỉ tên nhỏ, giờ, số đếm mới 12).
Luật: `verify-against-visualize` (status dot = vòng rỗng), `table-heroui-native-section-head` (lone sentence), `type-scale-14-12`.
Grammar: `Badge isDot`, `node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`; `Alert`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`; `Text`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`.

## Nhóm "Lịch làm việc" và "Mục tiêu": nhãn mục + nút "Thêm"
Vì sao: OK — nhãn mục (Label 14, đậm 500) nằm trên nền hồng, đúng một nhãn, không mô tả. Lệnh "Thêm" không còn là Button trong đầu mục: nó nằm ở chân thẻ như lệnh của danh sách; bấm thì chân thẻ đổi thành form Huỷ/Thêm. Trên điện thoại không còn rớt dòng vì không còn gì ở đầu mục.
Luật: `surfacecard-zones-api` (headers/footers), `table-heroui-native-section-head` (đầu mục: nhãn trái, tối đa một Link hoặc ⓘ phải).
Grammar: `SurfaceCard kind="list" footers=[{kind:"more", label, press}]`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts` (FooterZone). Code: `fe/apps/web/src/components/branches/AgentWorkRows/index.tsx`.

## Thẻ danh sách lịch (mỗi dòng: câu mô tả, lần chạy kế, công tắc, menu)
Vì sao: OK — mỗi trigger là một dòng của một danh sách; câu mô tả là tiêu đề, lần chạy kế là dòng phụ, công tắc ở mép phải (`control`) và menu "Gỡ" (`menu`) chỉ cho trigger do người thêm. Dòng được Grammar vẽ bằng dữ liệu `ListRowData` (badges, action, menu, control), không dựng tay bằng Cluster.
Luật: `surfacecard-select-subtitle` (hàng có công tắc), `nivo-compose-architecture`, `blocks-are-real-code`.
Grammar: `SurfaceCard kind="list" items` (`ListRowData.control`, `.menu`, `.action`, `.badges`), `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`; `Switch`, `node_modules/@starci/grammar/dist/core/leaf/Switch/index.d.ts`.

## Trạng thái rỗng trong từng thẻ ("Chưa có lịch nào", "Chưa có mục tiêu nào", "Hiện trợ lý không làm việc nào")
Vì sao: mỗi danh sách rỗng hiện một `EmptyNotice` (ô icon + một câu) bên trong thẻ trắng của nó vì thẻ vẫn mang đầu mục và lệnh Thêm. Luật "EmptyNotice trên pane thì không khung" áp cho pane; ở đây là `SurfaceCard empty` nên giữ thẻ. Ba thẻ rỗng xếp chồng làm trang trống nhưng đúng luật một-nội-dung-một-thẻ; ô icon đúng luật icon đứng một mình = tile.
Luật: `table-heroui-native-section-head` (ONE CONTENT PER CARD), `verify-against-visualize` (icon tile).
Grammar: `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; `SurfaceCard empty`.

## Mục tiêu có dữ liệu (chip trạng thái + nút "Xong")
Vì sao: chip trạng thái (accent = đang mở, xám = đóng) và nút "Xong" là Button sm trung tính không icon, đúng luật sm không icon. Shot không có mục tiêu nên chỉ kiểm bằng code; cùng lỗi dựng tay `detail` Cluster như nhóm Lịch.
Luật: `suggestion-button-sm`, `page-header-left-sublabel-xs` (sm không icon), `verify-against-visualize`.
Grammar: `Button intent="neutral" size="sm"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; `Badge`.

## Nhóm "Việc đang làm" (hai việc "care due …")
Vì sao: OK — tiêu đề dòng là câu tiếng Việt "Chăm sóc khách đến hạn" và dòng phụ "Đến hạn sau 21 giờ nữa · Xem lại sau 21 giờ nữa"; chuỗi nội bộ "care due <thời điểm>" được dịch ở nguồn đọc (`toTaskView`), không còn lộ ra UI. Hành động của dòng là `action` ("Đóng việc") và, khi có việc liên kết, "Mở việc" kèm menu ⋯ cho "Đóng việc".
Luật: `verify-against-visualize` (không id/khoá thô), `workflow-memory-contracts` (nhãn tiếng Việt), `table-heroui-native-section-head`.
Grammar: `SurfaceCard kind="list"` `ListRowData.action` + `.menu`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`. Code: `fe/apps/web/src/modules/agentWork/agentWork.rows.ts` (`taskWordsOf`).

## Form thêm tại chỗ (mục tiêu, lịch) và dòng "chỉ chủ mới thêm"
Vì sao: bấm Thêm mở form ngay dưới danh sách trong chân thẻ (`footers` custom) có Huỷ/Thêm; người không có quyền thấy một dòng 12px muted. Không có trong shot (chưa bấm), đánh giá theo code: chân thẻ custom được luật cho phép (form footer Huỷ/Lưu).
Luật: `table-heroui-native-section-head` (form footer Huỷ/Lưu thuộc thẻ), `surfacecard-select-subtitle`.
Grammar: `SurfaceCard footers [{ kind: "custom" }]`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`; `Form`, `node_modules/@starci/grammar/dist/core/frame/Form/index.d.ts`.

## Giếng hồng và độ rộng nội dung
Vì sao: chỉ giữa là nền hồng, các thẻ trắng nổi cách nhau 12–16px, nội dung bị chặn 80rem và căn giữa; dải đầu và sidebar trắng.
Luật: `pink-page-surface-rule`, `nivo-surface-layering`, `page-header-left-sublabel-xs` (80rem cap).
Grammar: `PaneGrid` + `Pane area="well" content="cards"`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`.

## Điện thoại 390
Vì sao: OK trên trang này — thẻ full width, lề 16px, "Thêm" nằm ở chân thẻ nên đầu mục luôn một hàng, sidebar thu thành nút ⋯. Dải tab tầng 1 cuộn ngang bằng nút mũi tên: đó là hành vi của Grammar `Tabs` (nút icon-only sm), không phải của trang; trang không có cách khác để sửa ngoài việc Grammar đổi.
Luật: `page-header-left-sublabel-xs`, `table-heroui-native-section-head`.
Grammar: `Tabs` overflow, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`; `PaneGrid`, `node_modules/@starci/grammar/dist/core/frame/PaneGrid/index.d.ts`. Grammar gap: mũi tên cuộn của Tabs là nút icon-only.
