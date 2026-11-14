---
title: Hồ sơ agent (Kế toán)
route: /workspaces/<ws>/agents/profile/<agentId>
area: team-permissions
---
Hồ sơ của một agent (Kế toán), mở từ Tổng quan / Đội ngũ / Kế toán: việc gần đây, ai chịu trách nhiệm, ai được giao việc, agent nó được tag tiếp, quy tắc áp dụng. Trang là một báo cáo (`layout="report"`): giếng hồng, các mục xếp một cột. Thanh trên, sidebar, dải đầu trang (đường dẫn, tên, chip "Agent" / "Hỏi trước", nút "Mở agent", menu ⋯) và nút trợ lý nổi giải thích một lần ở `gallery/pages/shell/khung-chung/`. Nút "N" tròn của Next là lớp dev, không phải nội dung. Block `AgentProfileHead`, `AgentProfileRecent`, `AgentProfileOwner`, `AgentProfileAssignable`, `AgentProfileTags`, `AgentProfileRules` (`fe/apps/web/src/components/blocks/`).

## Việc gần đây (đầu mục có chip đếm và "Xem tất cả →", một thẻ danh sách)
Vì sao: đầu mục là một hàng: tên mục 14/500, chip đếm xám 12 (tổng số việc, 6) và MỘT liên kết điều hướng "Xem tất cả →" ở cuối hàng (sang tab Công việc của agent). Các việc giống hệt nhau (cùng tiêu đề, cùng khách, cùng trạng thái) gộp thành một dòng có "×4" ở cuối dòng, không lặp bốn lần. Trạng thái: "Hoàn tất" màu success; việc chờ chủ duyệt là chip hồng "Chờ bạn duyệt" (hồng chỉ dành cho việc chờ chủ). Tập hợp nhiều việc nên mới là thẻ.
Luật: `table-heroui-native-section-head.md` (đầu = nhãn + chip trái, một liên kết → phải, không mô tả), `surfacecard-zones-api.md`, contexts `card.md` CARDS-FOR-COLLECTIONS, `WHITE-LIST-BORDERED-CARD`.
Grammar: `Section kind="list" count action` với `Link variant="head"`, `ListRowData { badges, meta }` (`node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`, `.../frame/Section/head.d.ts`, `.../surfaceCardData.d.ts`); code `components/composites/ListRegion`, block `AgentProfileRecent`, gộp bằng `groupRecent`.

## Người phụ trách (trường phẳng: tên + mô tả bên trái, người bên phải)
Vì sao: một giá trị duy nhất nên là trường phẳng trên giếng hồng, không thẻ, không đường kẻ (FLAT-FIELDS-ON-WELL). Trái: tên trường 14/500 và mô tả 12 muted "Nhận việc agent bị kẹt, bị từ chối, quá hạn." (mô tả của chính trường, không phải dòng chú thích rời). Phải: avatar, tên hiển thị thật và vai trò 12 muted. Tên là tên hiển thị của người đó; khi hệ thống chỉ có tên đăng nhập ("nivo-owner") thì đọc thành chữ ("Nivo Owner"), không bao giờ hiện tên đăng nhập thô.
Luật: `table-heroui-native-section-head.md`, `owner-colors-exact.md`, contexts `field.md` FLAT-FIELDS-ON-WELL, `card.md` CARD-NO-DESCRIPTION.
Grammar: `Stack`, `Cluster`, `Text`, `Avatar` qua `PersonAvatar` (`node_modules/@starci/grammar/dist/core/leaf/Avatar/index.d.ts`); khung ứng dụng `components/frames/FieldBlock`; block `AgentProfileOwner`, tên qua `personNameOf`.

## Ai được giao việc (trường phẳng: tên + mô tả bên trái, chip vai trò bên phải)
Vì sao: một trường phẳng, không thẻ. Trái: tên "Ai được giao việc" và mô tả "Các vai trò và phòng ban được phép giao việc." (một lần, ngay dưới tên). Phải: các vai trò (và phòng nếu có) là chip trung tính 12. Không còn mô tả trong thẻ và không còn thẻ khóa-giá trị "Vai trò".
Luật: `table-heroui-native-section-head.md`, contexts `field.md` FLAT-FIELDS-ON-WELL, `card.md` CARD-NO-DESCRIPTION, CARDS-FOR-COLLECTIONS.
Grammar: `Badge tone="neutral"`, `Cluster justify="end"` (`node_modules/@starci/grammar/dist/core/leaf/Badge/index.d.ts`, `.../frame/Cluster/index.d.ts`); khung `FieldBlock`; block `AgentProfileAssignable`.

## Agent được tag tiếp (đầu có chip đếm, thẻ danh sách, cả dòng bấm được)
Vì sao: là tập hợp agent nên mới là thẻ; đầu mục tên + chip đếm xám (1), không liên kết cuối hàng vì mỗi dòng đã dẫn đi. Mỗi dòng là một agent: avatar agent, tên (danh từ) và phụ đề 12 nói vai trò và vì sao nó được tag ("Bán hàng · Nhận việc Kế toán chuyển sang"). Cả dòng bấm được, cuối dòng có mũi tên chevron, mở hồ sơ agent đó. Đã bỏ chip "AI" vì không nói thêm gì (mọi agent đều là AI); chỉ agent đang tạm dừng mới có chip đỏ "Đang tạm dừng".
Luật: `surfacecard-select-subtitle.md` (tiêu đề dòng + phụ đề), `table-heroui-native-section-head.md`, contexts `card.md` ROW-TITLES-NOUNS, CARDS-FOR-COLLECTIONS.
Grammar: `Section kind="list" count`, `ListRowData { onPress, leading.avatar, description }` (cả dòng bấm, chevron tự vẽ) (`node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`, `.../composite/ListRow/index.d.ts`, `.../surfaceCardData.d.ts`); block `AgentProfileTags`.

## Quy tắc áp dụng (đầu có chip đếm và "Sửa ở tab Quyền →", thẻ danh sách)
Vì sao: đầu mục như mọi danh sách: tên + chip đếm xám (6) và MỘT liên kết điều hướng "Sửa ở tab Quyền →" ở cuối hàng (mở tab Quyền của agent `/agents/<module>/<id>/connections`); dòng chú thích rời "Quy tắc chỉ xem ở đây…" đã bỏ. Tiêu đề dòng là danh từ ("Thanh toán nhà cung cấp", "Hóa đơn xuất", "Email gửi khách"; khóa `agentProfile.ruleName_*`, không dùng cụm động từ chung `governance.action_*`). Phụ đề là lời giải thích của chính quy tắc; chế độ là chip cuối dòng (Tự động trung tính, Hỏi trước cam).
Luật: `table-heroui-native-section-head.md`, `surfacecard-select-subtitle.md`, contexts `card.md` ROW-TITLES-NOUNS, `CARD-NO-DESCRIPTION`.
Grammar: `Section kind="list" count action`, `Link variant="head"` (`node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`, `.../frame/Section/head.d.ts`); block `AgentProfileRules`.

## Đang tải, lỗi, rỗng
Vì sao: mỗi mục tự đọc và tự báo trạng thái: tải thì vẽ hàng xương cùng khuôn (chip đếm ẩn khi tải), lỗi thì thông báo nhẹ có "Thử lại" đặt trong chính trường hoặc thẻ của mục (tên mục vẫn ở ngoài), rỗng thì một câu ("Chưa có việc nào", "Chưa ai được giao việc"). Một mục lỗi không làm hỏng trang.
Luật: `workflow-memory-contracts.md`, contexts `loading.md` STATE-8.
Grammar: `SlotView` (`packages/agent-sdk/src/client/SlotView.tsx`), `Section isLoading error`, `Skeleton` (`node_modules/@starci/grammar/dist/core/leaf/Skeleton/index.d.ts`).

## Bố cục điện thoại 390
Vì sao: cùng một cột; nút "Mở agent" của dải rơi xuống dòng riêng dưới tên (Grammar xếp lệnh dưới tiêu đề dưới 768); trường phẳng giữ tên + mô tả bên trái và giá trị bên phải; dòng danh sách xuống dòng khi hẹp. Nút trợ lý nổi che chip cuối của dòng cuối chỉ là lớp nổi chung, không phải nội dung trang.
Luật: `nivo-surface-layering.md`, `pink-page-surface-rule.md`.
Grammar: `Page` `layout="report"` (`node_modules/@starci/grammar/dist/core/frame/Page/index.d.ts`), `Cluster wrap`.
