---
title: Quyền (Bán hàng), xác nhận "Gỡ khỏi agent"
route: /workspaces/<ws>/agents/sales/<installation>/connections
area: agent-connections
---
State of `agent-connections/sales-quyen` after "Gỡ khỏi agent" is chosen in the ⋯ menu of a provider card: a confirm dialog opens before anything is removed. Grammar paths are under `node_modules/@starci/grammar/dist/core/`.

## Hộp xác nhận (tiêu đề "Gỡ <provider> khỏi <agent>?", mô tả, "Huỷ", "Gỡ khỏi agent")
Vì sao: removing a provider takes every right the agent had through it, so the destructive command lives in the card menu and is confirmed here. The title names the provider and the agent, the description says the agent stops using it and that it can be attached again, and the confirm button repeats the menu word in the danger tone; "Huỷ" is the neutral way out.
Luật: `table-heroui-native-section-head` (destructive commands are never a visible button at rest; the confirming press belongs in a dialog), `verify-against-visualize`.
Grammar: `AlertDialog tone="negative"` (`frame/AlertDialog/index.d.ts`).

## Trang phía sau hộp
Vì sao: the Quyền tab with its provider cards stays visible under the scrim; the removal only happens on the confirming press.
Luật: `pink-page-surface-rule`.
Grammar: `AlertDialog` (`frame/AlertDialog/index.d.ts`).
