---
title: Thiết lập / Hướng dẫn (Kế toán)
route: /workspaces/<ws>/agents/accounting/<installation>/setup
area: agent-setup
---
# Thiết lập › Hướng dẫn (Kế toán)

Shots: `1440.png`, `1920.png`, `390.png`. Code: `features/pages/AgentSetupPage`, `components/blocks/AgentSetupPanes`, composites `AgentSetupUnderstanding`, `AgentSetupMap`, `AgentGraphMode`, `AgentSetupVersions`. Đường dẫn Grammar tính từ `node_modules/@starci/grammar/dist/`.

## Dải đầu trang và tab lớp hai Hướng dẫn | Quy trình | Chung
Vì sao: dải trắng không cuộn, chữ canh trái; hai tầng tab trong dải, lớp hai là ba phần của Thiết lập, gạch chân trên đường kẻ.
Luật: `page-header-left-sublabel-xs`, `pink-page-surface-rule`, ui-laws (Tabs: tối đa 2 lớp, lớp 2 trong dải).
Grammar: `Page` `header.tabs` / `subTabs`, `core/frame/Page/index.d.ts`.

## Bố cục hai cột: thẻ ở giữa, chat NIVO bên phải
Vì sao: `PaneGrid` hai cột; trái là giếng hồng cuộn với các khối cách nhau 24, phải là pane chat nguyên khối trắng, không phải thẻ; dưới medium chồng một cột, chat xuống cuối.
Luật: `pink-page-surface-rule`, `nivo-surface-layering`, ui-laws (Layout B).
Grammar: `PaneGrid` `columns`, `Pane area="side" surface`, `core/frame/PaneGrid/index.d.ts`, `core/frame/PaneSection/index.d.ts`.

## Agent hiểu gì về việc của bạn (Label) và ba nhóm bên trong
Vì sao: "Agent hiểu gì về việc của bạn" là Label của cả mục (14/500), phiên bản đang dùng ("Bản 7 · đang dùng") là chữ thường 12 muted ở cuối hàng, không phải chip. Bên trong, "Được tự làm", "Phải hỏi bạn", "Không bao giờ làm" là Sublabel (12/500 muted), mỗi nhóm một thẻ danh sách trắng ngay dưới (cách 8), các nhóm cách nhau 8 vì cùng thuộc Label này; khoảng cách lớn chỉ nằm giữa các mục cấp trên. Không lồng Label trong Label. Mỗi hàng: câu quy tắc, tên mục, chip trạng thái "Đã xác nhận", nút "Sửa" sm neutral ở cuối.
Luật: `surfacecard-select-subtitle` (Label / Sublabel hierarchy, Versions), `type-scale-14-12`, `suggestion-button-sm`.
Grammar: `Sublabel` (`core/leaf/Sublabel/index.d.ts`), `SurfaceCard kind="list"` với `actionPlacement="end"` (`core/surfaceCardData.d.ts`, ListData), `Stack gap="inline"`; Grammar 0.37.7 sẽ có API riêng cho nhóm này, hiện dùng Sublabel + token gap.

## Chú thích dưới các nhóm ("Đã xác nhận 6/6 · Bản 7 đang chạy · …")
Vì sao: một caption 12 muted nói về dữ liệu của các thẻ (tiến độ xác nhận, bản chạy), đúng chỗ của caption.
Luật: `surfacecard-select-subtitle` (caption chỉ cho chú thích dữ liệu), `type-scale-14-12`.
Grammar: `Text size="xs" tone="muted"`, `core/leaf/Text/index.d.ts`.

## Theo sơ đồ (công tắc)
Vì sao: một cài đặt đơn là hàng phẳng trên giếng: tên và mô tả bên trái, công tắc ở mép phải; không nằm trong đầu thẻ.
Luật: `surfacecard-select-subtitle` (Switch rows, flat fields), `surfacecard-zones-api`.
Grammar: `Switch` có `label` + `description` (0.37.5 vẽ nhãn trái, công tắc phải), `core/leaf/Switch/index.d.ts`; file `AgentGraphMode`.

## Sơ đồ làm việc (thẻ preview + "Mở sơ đồ")
Vì sao: sơ đồ là nội dung của một thẻ riêng, đầu thẻ là tên "Sơ đồ làm việc" không mô tả; preview `FlowGraph layout="steps"` ở cỡ đọc được (không co nhỏ; sơ đồ rộng thì kéo ngang), bấm bước mở drawer; "Mở sơ đồ →" sm neutral mở toàn màn qua Dialog.
Luật: `flowgraph-card-style`, `workflow-memory-contracts`, `type-scale-14-12`.
Grammar: `FlowGraph layout="steps" fit="readable"` (mặc định), `core/branch/FlowGraph/index.d.ts`; `Dialog size="full"`, `core/frame/Dialog/index.d.ts`; wrapper `AgentGraphCanvas`.

## Chú giải sơ đồ
Vì sao: chú giải là ghi chú về dữ liệu của thẻ nên nằm dưới thẻ (note của thẻ); không còn câu hướng dẫn rời.
Luật: `surfacecard-select-subtitle` (Subtitle rule), `flowgraph-card-style`.
Grammar: `FlowGraphLegend` làm `SurfaceCard note`, `core/branch/FlowGraph/index.d.ts`, `core/frame/SurfaceCard/index.d.ts`.

## Phiên bản (danh sách bản)
Vì sao: một thẻ danh sách, mới nhất trên cùng; chip "Đang dùng" là trạng thái; "Quay lại bản này" là nút sm neutral (tạo bản mới); phiên bản là chữ thường trong tiêu đề hàng.
Luật: `surfacecard-select-subtitle` (Versions), `suggestion-button-sm`.
Grammar: `SurfaceCard kind="list"` (`AgentSetupVersions`), `core/surfaceCardData.d.ts`.

## Pane chat "Thiết lập cùng NIVO"
Vì sao: pane chat bên phải là khung chat (đầu mark + tên, thread, composer tối thiểu 2 dòng với nút gửi bên trong) và nó là `--background` (hồng) dù đứng cạnh cột thiết lập; ô nhập trắng, bong bóng của NIVO trắng phẳng, tin của mình `--accent`. Chỉ thread cuộn (`role="log"`, mở ở tin mới nhất); ở 390 nó là khối cuối trang.
Luật: DNA-COMMON-CHAT-FRAME (khung chat là `--background` ở mọi trang), DNA-COMMON-CHAT-FRAME-SCROLL (chỉ thread cuộn), `chat-surfaces`, `page-header-left-sublabel-xs` (composer 2 dòng), `suggestion-button-sm`.
Grammar: `Pane content="chat"` (Grammar 0.37.33, `core/frame/PaneGrid/index.d.ts`); `PaneHeader`, `core/composite/PaneHeader/index.d.ts`; `MessageBubble`, `core/composite/MessageBubble/index.d.ts`.

## Trạng thái tải, lỗi, rỗng
Vì sao: mỗi khối đọc qua `SlotView` (skeleton cùng hình, thử lại mềm); không có quyền thì thay cả trang bằng `AgentSetupNotice`.
Luật: ui-laws (EmptyNotice phẳng), `blocks-are-real-code`.
Grammar: `EmptyNotice`, `core/composite/EmptyNotice/index.d.ts`.
