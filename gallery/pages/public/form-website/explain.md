---
title: Biểu mẫu website công khai
route: /w/<siteKey>
area: public
---
# Biểu mẫu để lại thông tin (/w/<siteKey>)

Block `WebsiteForm` (components/blocks/WebsiteForm/component.tsx) in `PublicShell` (components/frames/PublicShell). A visitor who never signs in leaves name, phone and a message for the shop. Shots `1440.png`, `390.png`; before shots are in `before/`. Grammar paths under `node_modules/@starci/grammar/dist/core/`. Next dev overlay in shots is not product UI.

## Thanh trên cùng (logo "NIVO os", nút ngôn ngữ)
Vì sao: SAI — the public bar draws the platform logo (no business is known on this key) and a text pill "Tiếng Việt" on desktop (`LanguageMenu isNamed`), a globe on the phone; the owner rule is that the language switch is the round icon button with a VI/EN dropdown everywhere, never a named pill; should be `LocaleSwitch` (the round button) at every width.
Luật: `locale-switch-round-dropdown.md`, `nivo-surface-layering.md` (white chrome bar).
Grammar: `TopBar brand actions`, `node_modules/@starci/grammar/dist/core/composite/TopBar/index.d.ts`; app composite `LanguageMenu` (should be replaced by `components/blocks/LocaleSwitch`).

## Nhãn khối "Để lại thông tin"
Vì sao: the block label sits on the pink above its card (title 14/500), as the layout law puts block labels on pink, not inside the card.
Luật: `pink-page-surface-rule.md` (only block labels sit on pink above their block), `type-scale-14-12.md`.
Grammar: `Section title`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts` or `PaneSection`.

## Thẻ biểu mẫu (Tên của bạn, Số điện thoại, Bạn cần gì?, nút "Gửi cho cửa hàng")
Vì sao: one input group in one white floating card, 480px reading measure centred; HeroUI grey fields with 14/500 labels, a textarea for the message, one commit pill left aligned at the end of the form. The card is the right wrapper because it is a genuine group, not a single field. The submit button is left aligned and not full width while the auth forms use full width commit buttons: inconsistent (minor).
Luật: `surfacecard-select-subtitle.md` (flat fields vs groups), `table-heroui-native-section-head.md` (form footer inside the card), `owner-colors-exact.md`.
Grammar: `Form`, `Input`, `Textarea`, `Button intent="commit"`, `SurfaceCard`, `node_modules/@starci/grammar/dist/core/frame/Form/index.d.ts`, `node_modules/@starci/grammar/dist/core/branch/Textarea/index.d.ts`.

## Dòng "Cửa hàng sẽ liên hệ lại với bạn sớm nhất có thể." dưới thẻ
Vì sao: SAI — a loose reassurance sentence under the card; captions under a card are only legends or notes about the card's data. It should be the card's subtitle or the success-state copy.
Luật: `surfacecard-select-subtitle.md` (subtitle rule).
Grammar: `SurfaceCard note`, `node_modules/@starci/grammar/dist/core/frame/SurfaceCard/index.d.ts`.

## Dòng chân trang "Vận hành bởi NIVO."
Vì sao: the platform credit centred at 12px muted under the page, the standard foot line of every public page.
Luật: `type-scale-14-12.md`.
Grammar: `Text size="xs" tone="muted"`, `node_modules/@starci/grammar/dist/core/leaf/Text/index.d.ts`; `PublicShell foot`.

## Trạng thái đã gửi / tắt / lỗi (không có trong shot)
Vì sao: CHƯA RÕ — the block has sent, off, empty and failed bodies (`sentTitle`, `offBody`, `emptyBody`, `failedBody`) but no shot shows them; cannot be checked.
Luật: `verify-against-visualize.md`.
Grammar: `Alert`, `EmptyNotice`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts`.

## Bố cục điện thoại 390
Vì sao: the card fills the width with a 12px gutter and the language control collapses to the globe icon (which is the correct form), so on the phone the page already matches the locale rule and only desktop breaks it.
Luật: `locale-switch-round-dropdown.md`, `nivo-surface-layering.md`.
Grammar: `TopBar`, `PublicShell measure="reading"`.
