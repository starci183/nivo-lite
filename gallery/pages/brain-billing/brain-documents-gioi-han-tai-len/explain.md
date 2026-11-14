---
title: Second Brain / Thêm tài liệu: file vượt chỗ còn lại (mẫu)
route: /workspaces/<ws>/brain?tab=knowledge&view=documents
area: brain-billing
---
# Second Brain / Thêm tài liệu: file vượt chỗ còn lại (mẫu)

> MOCKED shot: the browser answers `KnowledgeUsage` (limit 20.971.520 bytes) and `KnowledgeSources` with made-up figures on the NIVO workspace; nothing is read from or written to the dev data for these figures.
State 3: a 2,6 MB file is chosen while only 1,5 MB of 20 MB is left. The browser refuses it BEFORE any upload request (no `createKnowledgeUpload` is sent); the server's `KNOWLEDGE_SOURCES_QUOTA_EXCEEDED` and the plan's `BILLING_STORAGE_QUOTA_EXCEEDED` are read the same way. Shown on the add drawer of `/knowledge/nivo`, where the add flow lives.

## Thông báo file bị từ chối
Vì sao: a neutral `Alert` at the top of the files panel: "Chưa tải lên được “<tên file>”" and "File nặng F, tiệm chỉ còn Y trên L. Xoá bớt tài liệu cũ rồi tải lại." with ONE neutral sm action "Xem tài liệu" (no icon, closes the drawer onto the documents). The numbers come from what the browser knew or from the server's params. The alert tone is `neutral` because Grammar draws the action of an `informative` alert as the red commit button.
Luật: `red-budget-links-foreground`, `suggestion-button-sm`.
Grammar: `Alert tone="neutral"` `action`, `node_modules/@starci/grammar/dist/core/composite/Alert/index.d.ts` (the action intent follows the tone).

## Dòng tệp bị lỗi trong hàng đợi
Vì sao: the file stays in "Sắp thêm" as a failed row with the short reason ("Tiệm chưa đủ chỗ cho tệp này.") and the existing retry and remove commands; nothing was stored.
Luật: `badge-dot-or-not` (the failed status is a state), `row-control-clearance`.
Grammar: `Section kind="list"`, `Badge`, `node_modules/@starci/grammar/dist/core/frame/Section/index.d.ts`.

## Ngăn kéo Thêm tài liệu
Vì sao: the drawer itself (mode pills, drop zone, Drive, links, options, footer) is unchanged; the drop-zone hint no longer states a number (the limit is the server's).
Luật: `complex-content-page-not-drawer` (a short form stays a drawer).
Grammar: `Drawer`, `node_modules/@starci/grammar/dist/core/frame/Drawer/index.d.ts`.
