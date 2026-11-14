---
title: Cài đặt workspace
route: /workspaces/<ws>/settings
area: team-permissions
---
# Cài đặt workspace

> Shots missing: `1440.png`, `390.png`, the loading page (`../settings-dang-tai`), the read-only view of a member who is not owner or manager, and the logo upload error. No stack could run when the page was built (BIZ-MOVE round, lane FE-A) and no drawing was approved first: the page is built only from the Account page's patterns (`features/pages/AccountPage`, `components/blocks/AccountProfile`) so it asks for no new design decision. Every region below is "expected", not "observed": check each one against the first real shot.

Block `WorkspaceSettings` (components/blocks/WorkspaceSettings/component.tsx), page `SettingsPage` (features/pages/SettingsPage). Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Dải đầu trang (đường dẫn "Tổng quan / Cài đặt workspace", tiêu đề, dòng mô tả)
Vì sao: the same band as every console page that has no tabs (credits): breadcrumb, a 14/600 title, one muted 12 line under the title, all flush left. No tabs and no right-hand command: the page's one command lives in the form card's foot.
Luật: `page-header-left-sublabel-xs.md`, `nivo-surface-layering.md`, `type-scale-14-12.md`.
Grammar: `Page header`, `PageHeader`, `node_modules/@starci/grammar/dist/core/frame/PageHeader/index.d.ts`.

## Thẻ "Thông tin chung" (Tên workspace, Múi giờ, nút Lưu)
Vì sao: one form card on the pink well, two fields in a `Stack gap="row"` (name `Input`, time zone `ComboBox`: Grammar's `Select` has no search and the list is about 420 IANA zones; the saved zone is always an option), each with its hint under the label. The one primary command "Lưu" (commit intent, with the leading check glyph) sits at the end of the card's foot, as "Lưu hồ sơ" does on the profile card; a validation message shows under the field it belongs to. The name is the same value the lobby's rename writes, and the top bar takes it from the workspace list, so a save refreshes both.
Luật: `red-budget-links-foreground.md` (one main CTA per view), `suggestion-button-sm.md` and the button-icon rule (only the primary carries an icon), `row-control-clearance.md`, `type-scale-14-12.md`.
Grammar: `SurfaceCard footers`, `Form`, `Input`, `ComboBox`, `Button intent="commit" startGlyph`, `node_modules/@starci/grammar/dist/core/branch/ComboBox/index.d.ts`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Thẻ "Logo" (ảnh xem trước, Đổi logo, Gỡ logo, dòng "PNG, JPEG hoặc WebP, tối đa 2 MB.")
Vì sao: the same editor as the profile picture (`AvatarEditor`): a large preview that shows the chosen file at once while it uploads, a picker pill and a remove pill, the accepted-types line under them (replaced by the refusal when a file is wrong). The logo saves by itself when it is uploaded or removed (there is no Save for it, so the Save command stays the page's only CTA); with no logo the preview is Grammar's generated mark of the workspace id, the same mark the top bar draws. Removing asks first in an `AlertDialog` ("Gỡ logo của workspace?"), because the picture goes from the top bar of the whole team.
Luật: `blocks-are-real-code.md`, `red-budget-links-foreground.md`, `type-scale-14-12.md`.
Grammar: `AvatarEditor` (components/composites/AvatarEditor), `FileButton`, `AlertDialog`, `node_modules/@starci/grammar/dist/core/frame/AlertDialog/index.d.ts`.

## Nhân viên (không phải chủ sở hữu / quản lý) mở trang
Vì sao: the rail hides "Cài đặt" from staff (`managerOnly`, like Đội ngũ, Kết nối and Credit & gói), but the address still opens for them; they get the values read-only: the fields are disabled, the card has no foot and no Lưu, the logo card shows the picture only (no picker, no remove) and one muted 12 line says only the owner and managers can change it. The back end refuses the write anyway.
Luật: `verify-against-visualize.md`.
Grammar: `Input isDisabled`, `ComboBox isDisabled`, `Text size="xs" tone="muted"`.

## Bố cục điện thoại 390
Vì sao: the two cards stack in one column at the region gap; the logo preview and its two pills wrap as on the profile card; the Lưu button stays at the end of the foot. Nothing is hidden.
Luật: `nivo-surface-layering.md`.
Grammar: `Page measure="product"`.
