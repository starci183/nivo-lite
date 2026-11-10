---
title: Mẫu agent (Mẫu của tôi / Chợ agent) và mẫu quy trình
route: /workspaces/<ws>/agents/templates
area: flowgraph
---
Shot: `1440.png` (tab "Mẫu của tôi", rỗng). Code: `fe/apps/web/src/features/pages/AgentTemplatesPage/component.tsx` (ba view: `templates`, `marketplace`, `package`), blocks `AgentTemplatesHub`, `AgentMarketplace`, `AgentWorkflowTemplates`, `AgentTemplatePackage`. Chỉ view `marketplace` vẽ `AgentWorkflowTemplates` (danh sách mẫu quy trình + hộp chi tiết); shot này là view `templates` nên mẫu quy trình KHÔNG có trong shot, các vùng của nó ở dưới được đánh giá theo code. Grammar d.ts dưới `node_modules/@starci/grammar/dist/core/`.

## Dải trên cùng (nền hồng phía trên breadcrumb)
Vì sao: SAI — giữa thanh topbar và breadcrumb có một dải nền hồng cao khoảng 55px trước khi dải đầu trang trắng bắt đầu; luật: dải đầu trang là mặt phẳng trắng (breadcrumb, tiêu đề, tab nằm trong dải trắng có viền dưới), chỉ phần giữa mới hồng. Đây là khoảng đệm của khung trang hồng, không có chức năng. Should be: dải đầu trang trắng bắt đầu ngay dưới topbar. Lỗi ở khung (shell), cùng xuất hiện ở các shot cũ khác; kiểm lại trên bản chụp mới.
Luật: `nivo-surface-layering`, `pink-page-surface-rule` (chrome = surface; header band white).
Grammar: `Page`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`.

## Dải đầu trang: breadcrumb "Tổng quan / Agent / Mẫu agent", tiêu đề "Mẫu agent", mô tả, tab (Đang chạy, Chợ agent, Mẫu của tôi)
Vì sao: breadcrumb căn trái, tiêu đề trang, một câu mô tả 14 muted ("Cài agent do người khác làm ở chế độ chạy thử, hoặc đóng gói quy trình của agent bạn…") và một hàng tab gạch chân 14/40/500 sát đường kẻ, tab đang chọn "Mẫu của tôi" đậm hồng. Không có chip số trên tab vì tab trang ẩn số 0. Mô tả đứng dưới tiêu đề TRANG (không phải dưới nhãn mục) nên được phép; câu dài hai vế khó quét, nhưng không trái luật.
Luật: `page-header-left-sublabel-xs`, `type-scale-14-12`, `table-heroui-native-section-head` (Tab counts).
Grammar: `Page header title description tabs breadcrumbs`, `node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`; `Breadcrumbs`, `node_modules/@starci/grammar/dist/core/composite/Breadcrumbs/index.d.ts`; `Tabs`, `node_modules/@starci/grammar/dist/core/branch/Tabs/index.d.ts`.

## Thẻ rỗng "Bạn chưa đóng gói quy trình nào."
Vì sao: SAI — thẻ trắng nằm đè sát dưới đường kẻ tab, phần trên của thẻ (ô icon "hộp thư") bị đường kẻ cắt mất và không có khoảng đệm giữa dải đầu và nội dung; không có nhãn mục, không có lệnh "Đóng gói" dù trang mô tả nói "đóng gói quy trình của agent bạn". Trạng thái rỗng phải là `EmptyNotice` trong thẻ (hoặc không khung) có khoảng cách 12–16px dưới dải đầu, và có lối ra (lệnh/ liên kết tới nơi đóng gói, hiện ở `agents/templates/package/<installation>`). Should be: giếng hồng có đệm trên, thẻ có nhãn "Mẫu của tôi" + `EmptyNotice` với mô tả hướng dẫn và liên kết "Đóng gói từ agent →". Code: block `AgentTemplatesHub` (`fe/apps/web/src/components/blocks/AgentTemplatesHub`) và frame của trang.
Luật: `pink-page-surface-rule` (the well holds separate floating blocks, 12–16px apart), `table-heroui-native-section-head` (EmptyNotice, head one → link).
Grammar: `EmptyNotice message description iconSource`, `node_modules/@starci/grammar/dist/core/composite/EmptyNotice/index.d.ts`; `SurfaceCard empty labelEnd`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`.

## Danh sách "Mẫu quy trình" ở Chợ agent (không có shot, theo code)
Vì sao: một thẻ danh sách với nhãn "Mẫu quy trình" ở trên, mỗi mẫu một dòng (tên, mô tả "tóm tắt · số bản · số shop dùng") và hành động "Mở" ở cuối dòng, chú thích 12px dưới thẻ; một nội dung một thẻ, chú thích đúng chỗ. Chi tiết mở trong hộp thoại `Dialog size="lg"` với bản đồ của bản mới nhất và thay đổi từng bản. Lưu ý không nhất quán: mọi chi tiết khác của quy trình (bước, khác biệt, tạo từ mẫu) mở bằng ngăn kéo phải, riêng chi tiết mẫu mở bằng hộp thoại giữa màn hình; chủ chưa phán, ghi lại để quyết.
Luật: `table-heroui-native-section-head` (ONE CONTENT PER CARD, captions under card), `surfacecard-select-subtitle` (subtitle chỉ dưới title cùng dòng).
Grammar: `SurfaceCard kind="list" note`, `ListRowData action actionPlacement`, `node_modules/@starci/grammar/dist/core/surfaceCardData.d.ts`; `Dialog`, `node_modules/@starci/grammar/dist/core/frame/Dialog/index.d.ts`.
