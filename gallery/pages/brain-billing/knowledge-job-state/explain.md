---
title: Second Brain / Kiến thức / Tài liệu: trạng thái chuỗi việc của từng tài liệu
route: /workspaces/<ws>/brain?tab=knowledge&view=documents
area: brain-billing
---
# Danh sách tài liệu: trạng thái chuỗi việc (job progress) trên từng dòng

Frame `KnowledgeDocList` (the chip at the end of each row), hooks `useKnowledgeJobs` (follows the chains) over `useJobProgress` over `useSubscribeJobProgressSwr` (the generic job-progress door `GET /realtime/job-progress?roots=knowledge-source:<id>,...`: ONE connection for every followed row; past the door's limit of 50 chains the whole-workspace view with no selector), words in `modules/jobProgress/jobProgress.words.ts` + catalogue `jobProgress`. Replaces the old per-workspace knowledge-progress stream (deleted: `useSubscribeKnowledgeProgressSwr`, `stream-knowledge-progress.ts`). Source written 2026-11-14 (FE-JOBS): type-checked, linted and unit-tested only, NOT visually verified, no shots yet (`1440.png`, `390.png` to be taken by the screenshot check with a source being indexed, one retried, one dead-lettered).

## Con chip ở cuối dòng
Vì sao: a row follows its source chain of jobs only while a worker is on it or it failed (every such row, no cap: they all ride ONE stream; the retry time also arrives in the snapshot a late subscriber gets). The chip is the existing plain `Badge`; the words come from the catalogue, a label key the app does not know shows the generic state word, never the key:
- running: the step with its count, "Đang đọc tài liệu 3/12", "Đang chia đoạn", "Đang lập chỉ mục", "Đang xem tài liệu có gì đáng nhớ", "Đang rút ý chính"; `Badge isDot isLive` (a live status: the one case that has a dot), tone warning as the stored "Đang đọc" it replaces;
- retry: "Sẽ thử lại lúc 14:32" (the reader clock; "Sẽ thử lại" when the time is not known), `isDot isLive`, neutral;
- dead letter: a plain neutral `Badge` "Cần xử lý" (a result: no dot, not red: a person decides) and the class in plain words appended to the 12 muted line of the row: input "Không đọc được tệp này", config "Thiếu một kết nối hoặc một cài đặt", transient "Dịch vụ chưa trả lời", code "Lỗi ở phía NIVO";
- done: worded ("Xong") by the hook but not drawn on the list: a finished chain says nothing there, the stored status ("Sẵn sàng") is the settled word (a chain can be done between two of its jobs while the source still has facts to read).
No chain heard of yet (stream not open, row not followed): the stored status chip with its percent, as before. When a chain holds several jobs the one that matters shows: dead letter, then retry, then running, then the newest done.
Luật: `badge-dot-or-not` (dot only for live status), `red-budget-links-foreground`, `no-word-matching-code` (words by declared key and class, never by matching text), `type-scale-14-12`.
Grammar: `Badge isDot isLive`, `ListBox` item `trailing`, `Text size="xs" tone="muted"` (the row line).
