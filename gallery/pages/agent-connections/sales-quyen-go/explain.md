---
title: Quyền (Bán hàng), xác nhận "Gỡ khỏi agent"
route: /workspaces/<ws>/agents/sales/<installation>/connections
area: agent-connections
---
State of `agent-connections/sales-quyen` after "Gỡ khỏi agent" is chosen in the ⋯ menu of an account card (here Zalo OA): a confirm dialog opens before anything is removed. Grammar paths are under `node_modules/@starci/grammar/dist/core/`.

## Hộp xác nhận (tiêu đề "Gỡ <provider · tài khoản> khỏi <agent>?", mô tả, "Huỷ", "Gỡ khỏi agent")
Vì sao: removing an account (`detachAgentProvider({ agentId, connectionId })`) takes every right the agent had on THAT account (another account of the same provider keeps its own), so the destructive command lives in the card menu and is confirmed here. The title names the account ("<provider> · <account>") and the agent, the description says the agent stops using this account and that it can be attached again, and the confirm button repeats the menu word in the danger tone; "Huỷ" is the neutral way out.
Luật: `provider-rights-abilities` (per account), `table-heroui-native-section-head` (destructive commands are never a visible button at rest; the confirming press belongs in a dialog), `verify-against-visualize`.
Grammar: `AlertDialog tone="negative"` (`frame/AlertDialog/index.d.ts`).

## Trang phía sau hộp
Vì sao: the Quyền tab with its account cards stays visible under the scrim; the removal only happens on the confirming press.
Luật: `pink-page-surface-rule`.
Grammar: `AlertDialog` (`frame/AlertDialog/index.d.ts`).
