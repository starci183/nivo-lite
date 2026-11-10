---
title: Quy trình / Ngăn kéo tham số của một bước
route: /workspaces/<ws>/agents/<module>/<installation>/setup/workflows (bấm một thẻ bước trên bản đồ)
area: flowgraph
---
Shots: `1440.png` (ngăn kéo của một bước điều kiện (bước của bản mẫu cũ đã bị xóa, ảnh chưa chụp lại); nền phía sau là bố cục chủ-chi tiết cũ), `390.png` (cùng ngăn kéo trên điện thoại). Code: `fe/apps/web/src/components/composites/WorkflowStepDrawer/index.tsx`. Ngăn kéo này còn sống ở trang chi tiết (`AgentWorkflowDetail`), còn ở lượt chạy nó là chế độ chỉ đọc (xem `run-pinned`). Grammar d.ts dưới `node_modules/@starci/grammar/dist/core/`.

## Vỏ ngăn kéo: tên bước, mô tả, nút đóng
Vì sao: bấm một thẻ bước mở ngăn kéo phải (không rời trang); tiêu đề là tên bước tiếng Việt 14/500, dòng phụ 12px muted là mô tả bước ("xem việc vừa xảy ra"), nút đóng ✕ tròn ở góc; thẻ được mở có viền nổi trên bản đồ phía sau.
Luật: `flowgraph-card-style` (clicking a step opens a right drawer with a form from the node's param schema), `type-scale-14-12`.
Grammar: `Drawer title description footer closeLabel`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.

## Nhóm "Tham số" (Sublabel) và các trường sinh từ schema
Vì sao: các trường được sinh từ schema tham số của node: tiền là `NumberField` định dạng ₫ không nút tăng giảm, thời lượng/số là NumberField có đơn vị, lựa chọn là `Select`, đúng/sai là `Switch`, văn bản là `Input`/`Textarea`; mỗi trường có Label 14/500 + mô tả 12px + lỗi kiểm giới hạn. Nhãn nhóm "Tham số" là Sublabel 12 muted. Trường nằm trực tiếp trên nền trắng, không thẻ, không đường kẻ (flat fields). Khi bước không có tham số, một dòng muted "Bước này không có tham số để chỉnh." thay thế (shot này).
Luật: `flowgraph-card-style`, `surfacecard-select-subtitle` (Flat fields: title Label + description + content), `page-header-left-sublabel-xs` (Sublabel xs 12).
Grammar: `Form`, `NumberField`, `Select`, `Switch`, `Input`, `Textarea`, `node_modules/@starci/grammar/dist/core/frame/Form/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/NumberField/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Select/index.d.ts`, `node_modules/@starci/grammar/dist/core/leaf/Switch/index.d.ts`; `Sublabel`, `node_modules/@starci/grammar/dist/core/leaf/Sublabel/index.d.ts`.

## Dòng "Bước này không có tham số để chỉnh."
Vì sao: SAI — một câu muted đứng một mình dưới nhãn nhóm "Tham số" để báo rỗng, đáng ra là trạng thái rỗng thống nhất; câu này còn dùng `Text size="sm"` thay vì xs. Nhẹ, nhưng luật: rỗng là `EmptyNotice` (hoặc không vẽ nhóm). Should be: không vẽ nhóm "Tham số" khi không có trường, hoặc `EmptyNotice` không khung; dòng bước điều kiện vẫn có nhóm Nhánh bên dưới. Code: `WorkflowStepDrawer` `StepFields` (`emptyNote`).
Luật: `table-heroui-native-section-head` (EmptyNotice frameless), `type-scale-14-12`.
Grammar: `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`.

## Nhóm "Các nhánh" (mỗi nhánh một dòng: tên nhánh → bước đích; ảnh cũ vẽ 3 nhánh của bản mẫu cũ)
Vì sao: một danh sách có viền (trên mặt phẳng trắng, đúng luật bordered card) chỉ đọc, mỗi dòng: tên cổng là chip xám, mũi tên outline, rồi tên bước đích; số nhánh ở chip đếm 12px cạnh nhãn. Tên cổng và tên bước là chữ Việt giống chữ trên thẻ điều kiện của bản đồ. Cấu trúc nhánh sửa ở trình sửa sơ đồ, không ở ngăn kéo này, vì vậy chỉ đọc.
Luật: `surfacecard-zones-api` (list on white = bordered card + label above), `flowgraph-card-style` (named output ports).
Grammar: `Section kind="list" title count items`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`; `Badge`, `Icon`.

## Hộp lỗi (khi lưu bị từ chối)
Vì sao: khi server từ chối, một `Alert` âm tính với tiêu đề và lý do hiện cuối biểu mẫu, không đóng ngăn kéo để người dùng sửa; xem `workflows-refused`.
Luật: `flowgraph-card-style` (widening rights = owner only), `lead-freeze-on-failure` (lỗi nghiệp vụ nói rõ).
Grammar: `Alert tone="negative"`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Chân ngăn kéo: "Huỷ" và "Lưu thành bản 9"
Vì sao: một primary duy nhất "Lưu thành bản N" tạo phiên bản mới (không sửa bản cũ), vô hiệu (nhạt) cho tới khi có thay đổi hợp lệ; "Huỷ" là nút dismiss; trên desktop căn phải với Huỷ trước primary, trên điện thoại primary nằm trên và Huỷ ở dưới, mỗi nút rộng hết cột. Chữ "bản 9" là số thường, không chip.
Luật: `flowgraph-card-style` (Lưu thành bản N = new version), `surfacecard-select-subtitle` (version plain text), `verify-against-visualize` (primary md có thể có icon, ở đây không cần).
Grammar: `Button intent="commit" size="md"`, `Button intent="dismiss"`, `node_modules/@starci/grammar/dist/core/leaf/Button/index.d.ts`; `Drawer footer`.

## Điện thoại 390
Vì sao: ngăn kéo gần full width (chừa mép trái mờ để biết còn trang phía sau), tiêu đề + ✕, nội dung xếp một cột, chân hai nút dọc rộng hết cột. Phía sau nút hoạt động (nút "N" tròn góc dưới trái là công cụ dev của Next, không thuộc giao diện).
Luật: `nivo-surface-layering`, `page-header-left-sublabel-xs`.
Grammar: `Drawer`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.
