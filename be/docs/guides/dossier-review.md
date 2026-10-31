# Dossier review ("Rà soát hồ sơ")

Design approved by the owner on 2026-10-31 for build by three agents without a further question. The owner's intent, in
their words: "rules phần này khi up lên là agent phản biện tìm điểm vô lý cùng người dùng hoàn thiện tài liệu". When
documents are uploaded, an agent reads them critically, finds what contradicts, is missing, has expired, is unsigned, is
out of date after an event or is unreasonable, and works with the owner until the dossiers are complete. NIVO drafts,
the owner approves ("AI soạn, bạn duyệt").

It builds on the Second Brain ([second-brain.md](second-brain.md)): documents (`knowledge_sources`, the 50 MB raw-data
allowance), their passages (`knowledge_chunks`), the facts read out of them (`brain_facts`, proposals with evidence and
conflicts) and the dossiers imported from the checklist workbook (`brain_dossiers`, statuses present / partial /
drafted / missing / template).

The reference data set is a Vietnamese two-member LLC (64 dossiers in 12 categories plus `BKS`) with its checklist
workbook "00. BẢNG ĐỐI CHIẾU VÀ HỒ SƠ CÒN THIẾU.xlsx" and the final legal review "00. RÀ SOÁT PHÁP LÝ CUỐI - 27-10-2026.xlsx"
(sheets Kết luận từng hồ sơ, Vấn đề pháp lý, Đối soát chéo, Căn cứ pháp luật). Those sheets are what a human reviewer
produced by hand; this feature produces the same kind of finding automatically. Four findings it must produce on that
data, used as the acceptance set:

| #   | finding                                                                                                                                                                                     | kind                                                                                      | severity                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| A1  | The charter (dossier 02) is dated at founding and was not updated after the capital transfer of 17/08/2026                                                                                  | outdated                                                                                  | high                                      |
| A2  | Charter capital 300,000,000 in the registration certificate and charter, but a different contributed total in the bank statements (285 M in the owner's example; 182 M in the final review) | contradiction (+ unreasonable "contribution overdue" once the 90-day deadline has passed) | high (critical for the overdue shortfall) |
| A3  | The legal representative's file (dossier 06) has no CCCD of the legal representative                                                                                                        | missing                                                                                   | medium                                    |
| A4  | Two people hold "người phụ trách kế toán" at the same time: one bank still names the person who left, another bank and the appointment decision name the new one                            | contradiction                                                                             | high                                      |

Company-specific values (names, tax code, amounts, dates) never appear in code: they come from the workspace's facts and
documents. The rule pack is generic for a Vietnamese multi-member LLC. Specs use synthetic data ("Công ty TNHH Mẫu",
"Nguyễn Văn A").

## 1. How it flows

```
upload ─► index (chunks) ─► facts job (DocumentFactsService) ─finish/giveUp─► DossierReviewRunsService.requestForSource
                                                                              │  (coalesced run row + queue outbox, one tx)
remove source ─► DocumentFactsService.withdraw ─► requestForGoneSource ───────┤
"Rà soát lại cả bộ" / "Rà soát hồ sơ này" ─► requestDossierReview ────────────┤
approved remedy draft ─► new knowledge source ─► (indexed, facts) ────────────┘
                                                                              ▼
                       queue "knowledge", job dossier.review ─► DossierReviewRunnerService.run
                         1. collect inputs per dossier (sources, passages, facts, checklist row)
                         2. deterministic rules (rule pack vn-llc-64@1)            ── no tokens
                         3. AI pass per dossier whose inputs changed (port DossierReasoner) ── budgeted
                         4. evidence check: candidates without verifiable evidence are dropped
                         5. reconcile with stored findings (fingerprint), resolve what is no longer detected
                         6. recompute the dossier status
owner on /brain: confirm · dismiss (reason) · assign · upload the missing document · ask NIVO for a draft
  draft: dossier.remedy job ─► port RemedyWriter ─► proposed ─► owner edits / approves / rejects
  approve ─► knowledge source (tags dossier:<ref>, nivo:draft, remedy:<id>) ─► finding resolved (draft)
```

## 2. Findings model

A finding is one thing wrong with one dossier (or with the workspace as a whole, `dossier_id` null), backed by
evidence, with an owner and a lifecycle.

| field                                                                                                                                | meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                                                                                                                               | `contradiction` (two documents or facts disagree), `missing` (an expected document, signature page, value or field is absent), `expired` (a validity date passed, or passes within 60 days: `params.state` = `expired` / `expiring`), `unsigned` (only a draft or unsigned copy is held where a signed one is required), `outdated` (a document predates an event it must reflect), `unreasonable` (a value is impossible or breaks a limit: shortfall after a deadline, a wage under the regional minimum, shares not summing to 100 %, an end before a start, a repealed legal basis) |
| `severity`                                                                                                                           | `critical` (legal exposure now: a penalty-bearing breach or a passed statutory deadline; rules only), `high` (governance or registration gap, P0/P1 of the human review), `medium`, `low` (housekeeping). Only `critical`, `high` and `medium` findings demote a dossier's status                                                                                                                                                                                                                                                                                                       |
| `origin`                                                                                                                             | `rule` (deterministic) or `ai`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `rule_key`                                                                                                                           | the rule that produced it (`amounts.charter_capital`, `outdated.after_event`, …) or `ai`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `code`, `params`                                                                                                                     | for rule findings, the message code and its string params; the title and detail are rendered from the module's message catalog (vi stored; the API renders the request's locale)                                                                                                                                                                                                                                                                                                                                                                                                        |
| `title`, `detail`                                                                                                                    | the words people read (AI findings: in the documents' language, as the model wrote them)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `evidence`                                                                                                                           | 1 to 8 items `{ role, label, sourceId, sourceTitle, passageId, factId, factLine, quote }`; `role` is `claim`, `counter`, `expected`, `event` or `context`. `source_ids` and `fact_ids` columns repeat the ids for indexing                                                                                                                                                                                                                                                                                                                                                              |
| `remedy_action`, `remedy_document_type`                                                                                              | what completes it: `upload` (a document to collect), `draft` (NIVO can draft it: a resolution, a decision, a charter amendment, a register), `decide` (the owner must choose), `external` (a bank, a registry, a tax office)                                                                                                                                                                                                                                                                                                                                                            |
| `status`                                                                                                                             | `open` → `confirmed` · `dismissed` (reason required) · `resolved` (`resolution`: `document` a new document made it go away, `draft` an approved NIVO draft covers it, `not_detected` a re-check no longer finds it, `manual` the owner marked it done). `dismissed` and `resolved` can go back to `open`                                                                                                                                                                                                                                                                                |
| `assignee_id`, `due_at`                                                                                                              | the member who owns it and when; unassigned by default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `dossier_id`, `related_dossier_ids`                                                                                                  | the dossier it is filed under and the other dossiers it touches (A2 is filed under 02 and relates 01, 08, 10, 11, 12, 45)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `fingerprint`                                                                                                                        | the identity of the finding: unique per workspace; a re-run updates the same row instead of adding one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `evidence_hash`, `dismissed_evidence_hash`                                                                                           | what the evidence was; a dismissed finding re-detected with different evidence reopens (`reopened_count` + 1, note "new evidence")                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `first_seen_run_id`, `last_seen_run_id`, `first_seen_at`, `last_seen_at`, `resolved_at`, `decided_by`, `decided_at`, `decision_note` | history                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Lifecycle:

```
             confirm                      dismiss(reason)
   open ───────────────► confirmed ───────────────────────► dismissed
    │  ▲                     │                                 │  ▲
    │  └──── reopen ─────────┼──────────── reopen / re-detected with new evidence
    │                        │
    └── re-check no longer detects / new document / approved draft / mark done ──► resolved ── re-detected ──► open
```

A remedy draft is a separate row (`dossier_remedy_drafts`) pointing at its finding: `generating` → `proposed` →
`approved` | `rejected`, or `failed`. At most one `generating` or `proposed` draft per finding. Approving resolves the
finding with `resolution = draft`.

Fingerprints (sha256 hex, 32 chars) of `${rule_key}|${dossier_id ?? "-"}|${subject}`; each rule names its subject
(an invariant key, a role key plus its holders, an expectation key, a fact pair). AI findings: `ai|${dossier_id}|${kind}|`
plus the sorted ids of the sources and facts they cite; two AI findings with the same kind and the same citations merge.

## 3. Triggers, runs, budget, idempotency

### Triggers

| trigger         | when                                                                                                                                | scope                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document`      | the facts job of a source ends (`DocumentFactsService.finish`, and `giveUp` when facts could not be read: presence rules still run) | the dossier the source files under (its topic is the dossier category and its ref, from tag `dossier:<ref>` or a title starting `<n>. `); a source matching no dossier queues nothing |
| `document_gone` | a source is deleted (`DocumentFactsService.withdraw`)                                                                               | every dossier with a finding citing that source (`source_ids` GIN index), and the dossier its topic and title named                                                                   |
| `request`       | an owner or manager presses "Rà soát hồ sơ này" or "Rà soát lại cả bộ"                                                              | one dossier, or the workspace                                                                                                                                                         |
| `draft`         | an approved draft became a source                                                                                                   | rides on `document` when that source is read                                                                                                                                          |

The checklist import triggers nothing: after an import the page offers "Rà soát lại cả bộ".

A dossier run evaluates its dossier and the dossiers related to it by the rule pack and by shared fact subjects, so a
new bank statement re-checks capital consistency across 01, 02, 08 to 12 and 45 while the AI pass reads only the
affected dossier in full and the related ones as facts.

### Runs and coalescing

`dossier_review_runs` holds one row per requested run. A partial unique index allows one `queued` run per
(workspace, dossier or workspace): a request while one is queued inserts nothing (`INSERT … ON CONFLICT DO NOTHING`)
and enqueues nothing, so a folder upload of 300 files queues one run per touched dossier, not 300. A dossier request
is also skipped while a workspace run is queued. The row and the queue outbox entry (job `dossier.review`, dedupe key
`dossier.review:<runId>`) are written in one transaction (BE-PERSISTENCE-5).

The runner claims its run (`queued` → `running`, or a `running` row whose `started_at` is older than 15 minutes); a
second partial unique index allows one `running` run per workspace, so a concurrent claim fails and the job retries
later. A claimed row that is not `queued` any more ends the job without effect, so a redelivered job changes nothing
twice. A failed job ends the run `failed` with its error code (`onFailed`).

### Budget and cost

Deterministic rules cost no tokens and always run. The AI pass is metered and bounded:

| control           | value (constants of `dossier-review.contracts.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| credits           | `UsageMeterService.blockedBy(workspaceId, "brain", bulk)` before every AI call (bulk for a workspace run); blocked: AI is skipped (`ai_state = skipped_credits`), rule findings are still saved                                                                                                                                                                                                                                                                                               |
| usage             | every model call recorded with `UsageMeterService.record({ kind: "brain", module: "dossier_review" … })`                                                                                                                                                                                                                                                                                                                                                                                      |
| only what changed | each dossier keeps an `inputs_fingerprint` (prompt version, pack version, its sources with `updatedAt` and chunk count, its facts with status and value, its open rule findings); unchanged ⇒ no AI call (`skipped_unchanged`) and its AI findings are left as they are                                                                                                                                                                                                                       |
| per call          | prompt bundle ≤ 24,000 characters (≤ 12 documents, ≤ 3,000 characters per document in passages of ≤ 1,200, ≤ 120 facts of the dossier, ≤ 60 facts of related dossiers); answer ≤ 8 findings; timeout 60 s; one retry when the answer does not parse                                                                                                                                                                                                                                           |
| per run           | dossier run: 1 call; workspace run: at most 80 calls and 600,000 prompt tokens, dossiers ordered by their open rule findings' severity then by position; the rest keep their fingerprint unchanged, so the next run picks them up. The run's `ai_state` is `done` when every changed dossier was read, `partial` when the caps or a failed call left some out, `skipped_budget` / `skipped_credits` / `skipped_unchanged` when none was read for that reason, `failed` when every call failed |
| per workspace     | at most 150 review calls and 30 remedy drafts in a rolling 24 h (counted from the runs' and drafts' own rows)                                                                                                                                                                                                                                                                                                                                                                                 |
| drafts            | prompt ≤ 16,000 characters, body ≤ 40,000 characters, one call, timeout 90 s                                                                                                                                                                                                                                                                                                                                                                                                                  |

The 50 MB allowance is untouched: findings, runs, reviews and drafts are not counted, nothing new is stored in object
storage, and an approved draft enters through `KnowledgeSourcesService.addSource` like any pasted text, so its few
kilobytes count and a full allowance refuses the approval with the existing quota error (the draft stays `proposed`).

### Idempotency

- run coalescing and the job claim above;
- findings upsert on `(workspace_id, fingerprint)`;
- approval: a draft already `approved` returns as it is; before adding the source the service looks for a source tagged
  `remedy:<draftId>` and reuses it, so a retry after a crash between the two writes adds no second source;
- every user mutation reads the current row and refuses a transition its status does not allow (typed error).

## 4. Deterministic rules

All rules are pure policies over a collected **dossier input**: the dossier and its checklist row, the pack entry, its
sources classified as `actual`, `draft` or `template`, their passages, and the facts whose evidence cites those sources
(statuses `active`, `proposed`, `scheduled`: document facts are proposals until the owner applies them). A rule returns
**candidates** and the **coverage** it evaluated (`rule_key` × `dossier_id`); only covered findings may be resolved by
`not_detected`.

Document state of a source: `draft` when its tags hold `nivo:draft` or `draft`, or its title or origin matches
`dự thảo|du thao|chờ ký|cho ky|draft`; `template` when its tags hold `template`, or its origin matches
`_Mẫu cũ|bộ mẫu|template|biểu mẫu`, or its title equals the pack's template title; otherwise `actual`. Document date:
the earliest of its facts whose attribute is a signing / issue / effective date (`ngày ký`, `ngày ban hành`,
`ngày hiệu lực`, `ngày lập`), else a date in its title (`2026.01.09_…`, `09.01.2026`, `06.01.2026 …`); never the upload
time. Attribute matching uses `factSlugOf` of the pack's Vietnamese and English aliases.

| rule key                  | kind                   | what it checks                                                                                                                                                                                                                                                                                               | example                                                                 |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `presence.expected`       | missing                | each expectation of the dossier's pack entry is met by an `actual` (or, when `signed` is false, any) source whose title, or passages, match `titleAny` / `textAny`; an expectation `about` a role must also name the holder of that role (from facts)                                                        | A3: 06 expects "CCCD / căn cước / CMND" naming the legal representative |
| `presence.dossier`        | missing                | a `required` dossier with no `actual` and no `draft` source                                                                                                                                                                                                                                                  |                                                                         |
| `signatures.unsigned`     | unsigned               | a `signed` expectation met only by `draft` sources                                                                                                                                                                                                                                                           | the charter amendment exists only as "Dự thảo … chờ ký"                 |
| `signatures.placeholders` | missing (low)          | passages of `actual` or `draft` sources still holding `……`, `[...]`, `[ ]`, `[__]` or a bracketed number left to choose (`[65]%`); params count and first quote                                                                                                                                              | "Còn chỗ trống cần điền"                                                |
| `expiry.dates`            | expired                | facts with an expiry attribute (`ngày hết hạn`, `hết hạn`, `hiệu lực đến`, `có hiệu lực đến`, `expiry`, `expires`) or a `valid_to`: passed ⇒ high, within 60 days ⇒ medium                                                                                                                                   | a digital signature certificate, a domain                               |
| `expiry.untracked`        | missing (low)          | a pack entry with `tracksExpiry` and no expiry fact in its sources                                                                                                                                                                                                                                           | the domain register has no expiry date                                  |
| `amounts.invariant`       | contradiction          | every fact whose attribute is an alias of an invariant (`charter_capital`: `vốn điều lệ`, `charter capital`; `tax_code`: `mã số thuế`, `MST`) agrees across all documents, the authority dossiers first; differing values ⇒ one finding with every value as evidence                                         | A2                                                                      |
| `amounts.contribution`    | unreasonable           | a contributed total (`vốn đã góp`, `vốn thực góp`, `tổng vốn góp`) below charter capital once registration date + 90 days (LDN Đ.47) has passed ⇒ critical; before ⇒ low "contribution still open"                                                                                                           | A2's overdue shortfall                                                  |
| `amounts.shares`          | unreasonable           | member ownership percentages sum to 100 % and each member's capital equals share × charter capital (tolerance 1,000 VND)                                                                                                                                                                                     | 64 % / 36 % of 300 M = 192 M / 108 M                                    |
| `outdated.after_event`    | outdated               | for each event the pack entry `mustReflect` (`capital_transfer`, `member_change`, `registration_change`, `legal_rep_change`, `role_change`), the latest event date from facts; if every `actual` source of the dossier is dated before it ⇒ outdated, evidence the event fact and the newest document's date | A1: the charter dated at founding, the transfer on 17/08/2026           |
| `roles.holders`           | contradiction          | facts of the same role (`người phụ trách kế toán`, `kế toán trưởng`, `người đại diện theo pháp luật`, `giám đốc` / `tổng giám đốc`, `chủ tịch hội đồng thành viên`, `kiểm soát viên`) naming different people with overlapping validity (valid_from/valid_to, else document dates) across subjects           | A4: the bank still names the accountant who left                        |
| `roles.left`              | outdated               | a person with a leaving date (`ngày nghỉ việc`, `ngày thôi việc`, `chấm dứt hợp đồng`) before today who still holds a role in a fact without `valid_to`                                                                                                                                                      |                                                                         |
| `facts.conflict`          | contradiction (medium) | a fact with `conflict_with` where both sides are document facts of the workspace's dossiers; the owner's decision in Brain > Review makes it go away                                                                                                                                                         |                                                                         |
| `identifiers.canonical`   | contradiction (medium) | numbers next to `MST`, `mã số thuế`, `tax code` (10 or 13 digits) and next to `CCCD`, `căn cước` (12 digits) in passages that differ from the workspace's active value for that subject                                                                                                                      | "MST lạ", "Số 12 chữ số lạ"                                             |
| `citations.repealed`      | outdated (medium)      | passages of `actual` or `draft` sources dated on or after a citation's end date citing a repealed text of the pack's list (`NĐ 123/2020`, `NĐ 70/2025` → `NĐ 254/2026` from 01/07/2026; `TT 132/2018` → `TT 58/2026`; the Luật TNCN before `109/2025` from 01/07/2026)                                       | "Căn cứ pháp luật đã hết hiệu lực"                                      |
| `values.minimum_wage`     | unreasonable (medium)  | a salary fact (`mức lương`, `lương cơ bản`, `lương`) below the pack's regional minimum for its date (region III 4,140,000 VND from 01/01/2026)                                                                                                                                                               |                                                                         |
| `values.dates`            | unreasonable (low)     | an end before its start, or a document dated more than one day after today                                                                                                                                                                                                                                   |                                                                         |

The **rule pack** `vn-llc-64@1` is data in `dossier-pack.policy.ts`, keyed by the template ref of the standard 64-dossier
set (`1` … `64`, `BKS`), each entry:

```ts
interface PackEntry {
  readonly ref: string // "2"
  readonly nameHint: ReadonlyArray<string> // slugs the workspace dossier's name must contain ("dieu-le"); guards a renumbered checklist
  readonly requirement: "required" | "conditional" | "optional" | "template"
  readonly basis: ReadonlyArray<string> // "LDN 59/2020 (sđ 76/2025) Đ.24, 25"
  readonly expects: ReadonlyArray<Expectation>
  readonly mustReflect: ReadonlyArray<EventKey>
  readonly tracksExpiry: boolean
  readonly related: ReadonlyArray<string> // refs
  readonly remedy: { readonly documentType: string; readonly guidance: string } | null
}
interface Expectation {
  readonly key: string
  readonly label: string
  readonly titleAny: ReadonlyArray<string>
  readonly textAny: ReadonlyArray<string>
  readonly about: RoleKey | null
  readonly signed: boolean
  readonly severity: Severity
}
```

A workspace dossier takes the entry of its ref only when its name contains the entry's `nameHint`; otherwise only the
generic rules apply to it. Requirement comes from the final review's "Bắt buộc?" column: `Bắt buộc` → required;
`Bắt buộc khi họp`, `… khi lấy ý kiến`, `(hồ sơ ĐKDN)`, `thông tin đúng` → conditional; `Không bắt buộc`,
`Thực hành tốt`, `Lưu trữ` → optional; category 12 → template. Entries with explicit expectations, events and remedies
(the rest carry requirement, basis, related and remedy only):

| ref    | expects                                                                                                                              | mustReflect                        | remedy                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------- |
| 1      | registration certificate (`giấy chứng nhận đăng ký doanh nghiệp`, `GCN ĐKDN`, `GPKD`); the filed change dossier of the latest change | —                                  | — (external)                                                  |
| 2      | signed charter (`điều lệ`), signed                                                                                                   | capital_transfer, member_change    | "Nghị quyết HĐTV thông qua Điều lệ sửa đổi" + amended charter |
| 3      | seal decision (`quyết định … con dấu`), signed                                                                                       | —                                  | "Quyết định quản lý và sử dụng con dấu"                       |
| 4      | certificate register; tracksExpiry                                                                                                   | —                                  | —                                                             |
| 5      | bank account records per account (`tài khoản`, `ngân hàng`)                                                                          | role_change                        | "Giấy đề nghị thay đổi người phụ trách kế toán" (external)    |
| 6      | CCCD of the legal representative (`CCCD`, `căn cước`, `CMND`; about legal_representative)                                            | legal_rep_change                   | — (upload)                                                    |
| 8      | members register (`sổ đăng ký thành viên`), signed                                                                                   | capital_transfer, member_change    | "Sổ đăng ký thành viên"                                       |
| 10     | contribution minutes (`biên bản góp vốn`), signed                                                                                    | capital_transfer                   | "Biên bản góp vốn"                                            |
| 11     | contribution vouchers (`chứng từ góp vốn`, `sao kê`, `biên nhận`)                                                                    | capital_transfer                   | — (upload)                                                    |
| 12     | capital certificates (`giấy chứng nhận phần vốn góp`), signed                                                                        | capital_transfer                   | "Giấy chứng nhận phần vốn góp"                                |
| 19, 20 | members' council minutes and resolutions (`biên bản họp`, `nghị quyết`), signed                                                      | capital_transfer, legal_rep_change | "Biên bản và Nghị quyết HĐTV"                                 |
| 21     | election of the council chair (`bầu chủ tịch`), signed                                                                               | —                                  | "Nghị quyết bầu Chủ tịch HĐTV"                                |
| 23     | appointment decisions (`quyết định bổ nhiệm`), signed                                                                                | role_change                        | "Quyết định bổ nhiệm"                                         |
| 28     | labour contracts (`hợp đồng lao động`, `HĐLĐ`)                                                                                       | —                                  | —                                                             |
| 29     | staff files with CCCD of each current employee (about each person with a labour contract)                                            | role_change                        | —                                                             |
| 37     | NDA per current employee (`thỏa thuận bảo mật`, `NDA`), signed                                                                       | —                                  | "Thỏa thuận bảo mật"                                          |
| 53     | domain register; tracksExpiry                                                                                                        | —                                  | —                                                             |

The pack also holds the invariants, event and role aliases, the repealed-citations list and the wage table above. Its
version string enters every `inputs_fingerprint`, so a pack change re-runs the AI pass once.

## 5. The AI pass

One call per dossier (the affected one in a dossier run, each changed one in a workspace run), after the rules, through
the port `DossierReasoner` whose implementation lives in `dossier-review-ai` and calls `AiService.chat` (the app's
gateway client) with a JSON schema, as `DocumentFactsService` does.

### Bundle (built by the core, keys are the only way to cite)

```
DOSSIER  ref, name, category, requirement, basis[], checklist row (existing / missing / drafts text) as key C1
RELATED  ref and name of each related dossier
DOCUMENTS
  S1  "<title>" · state actual|draft|template · dated <date or unknown>
      S1.P1  <passage excerpt>
      S1.P2  …
FACTS
  F1  <subject> · <attribute> = <value> <unit> (status, from <valid_from>) — S1
  …   (then up to 60 key facts of related dossiers, marked with their dossier ref)
ALREADY FOUND (do not repeat)   K1 <kind> <title> …
OPEN AI FINDINGS (say whether each still applies)   A1 <title> — <detail>
TODAY  2026-10-31
```

### Prompt (`dossier-review-prompt.policy.ts`, version `dossier-review@1`)

System, in English with the answer language fixed to the documents' language:

> You review the corporate dossier of a Vietnamese limited liability company as a careful compliance reviewer. You
> receive one dossier: its documents as numbered passages (S1.P1 …), the facts read from them (F1 …), the checklist row
> (C1), the legal bases the dossier rests on, and the issues already found (K…). Find what is inconsistent, missing,
> expired, unsigned, out of date after an event, or unreasonable, across these documents and facts. Rules: cite only
> the keys given; every finding cites at least one S or F key, a contradiction cites at least two items from different
> documents or facts; each cited quote is copied verbatim from the cited passage or fact, at most 300 characters; do not
> repeat an issue listed under ALREADY FOUND; do not invent laws, numbers, dates or people; legal grounds may only be
> the bases listed; when unsure, leave it out; at most 8 findings. For each OPEN AI FINDING, answer whether it still
> applies; mark it resolved only by citing a passage or fact that resolves it. Write titles and details in Vietnamese
> when the documents are Vietnamese. Answer JSON only.

User: the bundle text above.

### Output schema (`dossier-review.schema.ts`, zod, bounded)

```ts
z.object({
  findings: z
    .array(
      z.object({
        kind: z.enum(["contradiction", "missing", "expired", "unsigned", "outdated", "unreasonable"]),
        severity: z.enum(["high", "medium", "low"]),
        title: z.string().min(3).max(140),
        detail: z.string().min(3).max(600),
        evidence: z
          .array(z.object({ key: z.string().max(16), quote: z.string().max(300) }))
          .min(1)
          .max(6),
        relatedRefs: z.array(z.string().max(8)).max(5),
        remedyAction: z.enum(["upload", "draft", "decide", "external"]),
        documentType: z.string().max(80).nullable(),
      }),
    )
    .max(8),
  stillOpen: z
    .array(
      z.object({
        key: z.string().max(8),
        applies: z.boolean(),
        evidence: z.array(z.object({ key: z.string().max(16), quote: z.string().max(300) })).max(3),
      }),
    )
    .max(20),
})
```

### Hallucination guard (`evidence.policy.ts`, in the core, applied to rule and AI candidates alike)

1. Every cited key exists in the bundle; a quote, normalised (NFC, whitespace collapsed, case folded), is a substring of
   the cited passage's text or of the cited fact's value or its evidence quote. A quote under 8 characters only counts
   for a fact key whose value it equals.
2. A candidate keeps only its verified evidence; it is **dropped** when no S or F evidence remains (C1 alone never
   suffices), when a contradiction keeps fewer than two items from different sources or facts, when its kind or severity
   is outside the enums, or when it repeats a known finding (same kind and the same cited ids as a K item or a rule
   finding).
3. AI findings never take `critical`; `relatedRefs` not among the related dossiers are removed.
4. An open AI finding is resolved only when `applies` is false **and** its resolving evidence verifies and cites a
   source newer than the finding's `first_seen_at`; otherwise it stays as it is. AI findings are never resolved by
   `not_detected`: a model that simply forgets one does not close it.
5. Dropped candidates are counted in the run's `stats.dropped` (logged with the reason), never stored.

## 6. Completing the dossiers with the owner

| action (owner or manager; members read)            | effect                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xác nhận (confirm)                                 | `open` → `confirmed`, optional note                                                                                                                                                                   |
| Bỏ qua (dismiss)                                   | reason 3 to 500 characters required; `dismissed`; keeps `dismissed_evidence_hash`                                                                                                                     |
| Mở lại (reopen)                                    | `dismissed` or `resolved` → `open`                                                                                                                                                                    |
| Giao việc (assign)                                 | assignee (a workspace member) and an optional due date                                                                                                                                                |
| Đánh dấu đã xử lý (mark done)                      | `resolved`, `resolution = manual`, note required (for `external` remedies done outside: "BIDV đã cập nhật")                                                                                           |
| Tải tài liệu lên (upload)                          | opens the existing add-documents drawer preset with the dossier's category as topic and tag `dossier:<ref>`; when the next run no longer detects the finding it resolves with `resolution = document` |
| Nhờ NIVO soạn (draft), for `remedy_action = draft` | `generating` draft + job `dossier.remedy`; optional instructions ≤ 1,000 characters                                                                                                                   |

Drafting (`RemedyWriter` port, implemented in `dossier-review-ai`): input is the finding with its verified evidence
quotes, the dossier, the pack's remedy document type and guidance, the workspace's identity facts (company name, tax
code, address, members and shares, legal representative, council chair; active and proposed facts only) and the
instructions. The model writes the document in Markdown; every value it does not have is a placeholder `[…: <what>]`
and listed in `placeholders`, never invented. Code appends the fixed tail (BE-AI-4): "Dự thảo do NIVO soạn ngày
<dd/mm/yyyy> theo phát hiện "<title>". Cần rà soát, điền chỗ trống và ký trước khi sử dụng." Output schema:
`{ title ≤ 160, documentType ≤ 80, body ≤ 40,000, placeholders: [{ label ≤ 120, reason ≤ 200 }] ≤ 30 }`.

Review: the owner reads the draft in a drawer, edits title and body (saved as the same `proposed` row), then:

- **Duyệt** (approve): the draft becomes a knowledge source (`kind text`, title prefixed with the dossier ref
  "02. …" so the existing dossier document count sees it, topic = the dossier's category, tags `dossier:<ref>`,
  `nivo:draft`, `remedy:<draftId>`, visibility internal, origin `dossier-review`); the finding resolves with
  `resolution = draft`. When the source is read, a `signatures.unsigned` finding opens for the dossier if its
  expectation is `signed`: "chờ ký" stays visible until the signed scan is uploaded, and the dossier shows `drafted`.
- **Từ chối** (reject), optional reason: the draft is `rejected`; the finding stays as it was.

### Dossier status, recomputed

Each run writes `dossier_reviews` per evaluated dossier. Its status replaces the imported checklist status on the page
once a dossier has been reviewed; the imported value stays in `brain_dossiers.status` and is shown beside it when they
differ ("Bảng đối chiếu: Có một phần"). `dossier-status.policy.ts`:

1. pack requirement `template` (or no pack entry and checklist `template`) → `template`;
2. no `actual` and no `draft` source: requirement `optional` → the checklist status, else `missing`;
3. no `actual` source but a `draft` one → `drafted`;
4. any active (`open` or `confirmed`) finding of severity critical, high or medium other than `unsigned` → `partial`;
5. an active `unsigned` finding → `drafted`;
6. otherwise `present`.

## 7. UI on the Second Brain page

Grammar components only (`@starci/grammar/common` 0.16.3: PaneGrid, Pane, ListBox, ListRow, SurfaceListCard,
SectionHeader, Badge, Button, EmptyNotice, Drawer, Dialog, Textarea, Select, SegmentedControl, StaticStateRow, Alert,
DataTable when it fits the list). No new visual primitives.

**Dossiers tab** (the existing PaneGrid of `BrainDossiers`): areas `base: ["list", "main"]`, `medium: ["list main"]`,
`wide: ["list main detail"]`; columns `wide: ["standard", "fill", "wide"]`. The `detail` pane is `collapse="drawer"`
(below 70rem it opens as the grid's drawer when a dossier is selected) and `scroll`, labelled with the dossier name.
Dossier rows become selectable (`?dossier=<id>` in the address); each row shows the recomputed status badge and, when
there are active findings, a count badge in the tone of the worst severity. The section header gets "Rà soát lại cả bộ"
(owner and manager), disabled with a progress line while a run is queued or running.

**Findings pane** (`DossierFindings` block in `detail`): header with the dossier, status, last reviewed time and
"Rà soát hồ sơ này"; an Alert when the last run skipped AI (no credits, daily budget); a SegmentedControl Đang mở /
Đã xác nhận / Đã đóng; rows (ListRow): severity badge, kind badge, "AI" badge for AI findings, title, detail as the one
description line, evidence quotes as StaticStateRows under the row when expanded (document title linking to the
document page), assignee and due date; row actions (neutral, `sm`): Xác nhận, Bỏ qua…, Giao…, Tải tài liệu lên, Nhờ NIVO
soạn / Xem dự thảo, Đánh dấu đã xử lý…, Mở lại. Dismiss, assign and mark-done open a Dialog (short focused task); the
draft opens the draft drawer.

**Cần xử lý tab** (`todo`, new in `BRAIN_TABS`, label with the open count): `DossierTodo` block, a workspace list of
active findings across dossiers, severity then age, with filters (SegmentedControl Tất cả / Của tôi / Chưa giao /
Chờ duyệt dự thảo; Select severity), Load more (connection paging). A row opens the dossier tab at
`?dossier=<id>&finding=<id>`.

**Draft drawer** (`DossierRemedyDraft` block, Drawer from the trailing edge): status line; while `generating` a
progress line (SWR refresh every 4 s, 0 once settled); title field, body Textarea, the placeholders as StaticStateRows,
the evidence it answers; footer decision group: Từ chối (neutral), Lưu (neutral), Duyệt và lưu vào hồ sơ (commit,
`type="submit"` on the form). The note "NIVO soạn, bạn duyệt. Văn bản chỉ vào hồ sơ khi bạn duyệt." Members see it
read-only.

Copy (namespace `dossierReview` in `vi.json` / `en.json`):

| key                                                                                  | vi                                                                                                                                                  | en                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tabTodo / tabTodoCount                                                               | Cần xử lý / Cần xử lý ({n})                                                                                                                         | To do / To do ({n})                                                                                                                                       |
| reviewAll / reviewOne                                                                | Rà soát lại cả bộ / Rà soát hồ sơ này                                                                                                               | Review all dossiers / Review this dossier                                                                                                                 |
| reviewRunning                                                                        | NIVO đang rà soát…                                                                                                                                  | NIVO is reviewing…                                                                                                                                        |
| reviewedAt                                                                           | Rà soát lúc {time}                                                                                                                                  | Reviewed {time}                                                                                                                                           |
| neverReviewed                                                                        | Chưa rà soát                                                                                                                                        | Not reviewed yet                                                                                                                                          |
| aiSkippedCredits / aiSkippedBudget                                                   | Hết credit nên chỉ chạy kiểm tra quy tắc; nạp thêm để NIVO đọc chéo tài liệu. / Đã chạm hạn mức rà soát AI trong ngày; phần còn lại chạy ở lần sau. | Out of credits, so only the rule checks ran; top up for NIVO to cross-read the documents. / Today's AI review allowance is used; the rest runs next time. |
| filterOpen / filterConfirmed / filterClosed                                          | Đang mở / Đã xác nhận / Đã đóng                                                                                                                     | Open / Confirmed / Closed                                                                                                                                 |
| filterAll / filterMine / filterUnassigned / filterDrafts                             | Tất cả / Của tôi / Chưa giao / Chờ duyệt dự thảo                                                                                                    | All / Mine / Unassigned / Drafts to approve                                                                                                               |
| severity_critical … _low                                                             | Nghiêm trọng / Cao / Trung bình / Thấp                                                                                                              | Critical / High / Medium / Low                                                                                                                            |
| kind_contradiction …                                                                 | Mâu thuẫn / Thiếu / Hết hạn / Chưa ký / Chưa cập nhật / Bất hợp lý                                                                                  | Contradiction / Missing / Expired / Unsigned / Out of date / Unreasonable                                                                                 |
| aiBadge                                                                              | AI phát hiện                                                                                                                                        | Found by AI                                                                                                                                               |
| confirm / dismiss / reopen / assign / markDone                                       | Xác nhận / Bỏ qua / Mở lại / Giao việc / Đánh dấu đã xử lý                                                                                          | Confirm / Dismiss / Reopen / Assign / Mark as done                                                                                                        |
| upload / askDraft / viewDraft                                                        | Tải tài liệu lên / Nhờ NIVO soạn / Xem dự thảo                                                                                                      | Upload the document / Ask NIVO to draft / View draft                                                                                                      |
| dismissTitle / dismissReason / dismissHint                                           | Bỏ qua phát hiện này? / Lý do / Lý do giúp NIVO không nhắc lại khi tài liệu không đổi.                                                              | Dismiss this finding? / Reason / The reason keeps NIVO from raising it again while the documents stay the same.                                           |
| assignTitle / assignee / dueDate / unassigned                                        | Giao việc / Người phụ trách / Hạn xử lý / Chưa giao                                                                                                 | Assign / Owner / Due date / Unassigned                                                                                                                    |
| markDoneTitle / markDoneNote                                                         | Đánh dấu đã xử lý / Đã làm gì (ví dụ: ngân hàng đã cập nhật)                                                                                        | Mark as done / What was done (for example: the bank updated it)                                                                                           |
| draftTitle / draftNote / draftGenerating / draftFailed                               | Dự thảo của NIVO / NIVO soạn, bạn duyệt. Văn bản chỉ vào hồ sơ khi bạn duyệt. / NIVO đang soạn dự thảo… / NIVO chưa soạn được dự thảo. Thử lại sau. | NIVO's draft / NIVO drafts, you approve. It joins the dossier only once you approve it. / NIVO is drafting… / NIVO could not draft it. Try again later.   |
| draftInstructions                                                                    | Dặn NIVO thêm (không bắt buộc)                                                                                                                      | Notes for NIVO (optional)                                                                                                                                 |
| draftPlaceholders                                                                    | Chỗ cần điền trước khi ký                                                                                                                           | To fill in before signing                                                                                                                                 |
| approveDraft / rejectDraft / saveDraft                                               | Duyệt và lưu vào hồ sơ / Từ chối / Lưu                                                                                                              | Approve and file it / Reject / Save                                                                                                                       |
| approved / rejected / saved / confirmed / dismissed / assigned / done / reviewQueued | Đã lưu dự thảo vào hồ sơ / Đã từ chối dự thảo / Đã lưu / Đã xác nhận / Đã bỏ qua / Đã giao việc / Đã đánh dấu xử lý / Đã yêu cầu rà soát            | Draft filed / Draft rejected / Saved / Confirmed / Dismissed / Assigned / Marked as done / Review requested                                               |
| emptyDossier / emptyTodo                                                             | Chưa thấy điểm nào cần xử lý ở hồ sơ này. / Không còn việc cần xử lý.                                                                               | Nothing to fix in this dossier. / Nothing left to do.                                                                                                     |
| checklistStatus                                                                      | Bảng đối chiếu: {status}                                                                                                                            | Checklist: {status}                                                                                                                                       |
| evidenceFrom                                                                         | Trích từ "{title}"                                                                                                                                  | From "{title}"                                                                                                                                            |
| resolution_document / _draft / _not_detected / _manual                               | Đã có tài liệu mới / Đã có dự thảo được duyệt / Lần rà soát sau không còn thấy / Đã xử lý bên ngoài                                                 | A new document covers it / An approved draft covers it / No longer found / Done outside                                                                   |

## 8. Data model, migration, API, jobs

### Migration `db/migrations/<stamp>_dossier-review.sql` (forward only; `npm run db:new -- dossier-review`)

```sql
-- dossier-review: forward-only; immutable once on origin/main.
-- The findings of the dossier review of a workspace's Second Brain, its runs, the status it computes per dossier and the
-- remedy drafts NIVO writes for the owner to approve.
CREATE TABLE public.dossier_review_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    scope text NOT NULL,
    dossier_id uuid REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    trigger text NOT NULL,
    trigger_ref uuid,
    status text NOT NULL DEFAULT 'queued',
    requested_by uuid,
    ai_state text,
    stats jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_review_runs_scope_check CHECK (scope IN ('dossier', 'workspace')),
    CONSTRAINT dossier_review_runs_scope_dossier_check CHECK ((scope = 'dossier') = (dossier_id IS NOT NULL)),
    CONSTRAINT dossier_review_runs_trigger_check CHECK (trigger IN ('document', 'document_gone', 'request')),
    CONSTRAINT dossier_review_runs_status_check CHECK (status IN ('queued', 'running', 'done', 'failed')),
    CONSTRAINT dossier_review_runs_ai_state_check CHECK (ai_state IS NULL OR ai_state IN ('done', 'partial', 'skipped_unchanged', 'skipped_credits', 'skipped_budget', 'failed'))
);
CREATE UNIQUE INDEX dossier_review_runs_one_queued ON public.dossier_review_runs
    (workspace_id, COALESCE(dossier_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'queued';
CREATE UNIQUE INDEX dossier_review_runs_one_running ON public.dossier_review_runs (workspace_id) WHERE status = 'running';
CREATE INDEX dossier_review_runs_recent_idx ON public.dossier_review_runs USING btree (workspace_id, created_at DESC);

CREATE TABLE public.dossier_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    dossier_id uuid REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    related_dossier_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    kind text NOT NULL,
    severity text NOT NULL,
    origin text NOT NULL,
    rule_key text NOT NULL,
    fingerprint text NOT NULL,
    code text,
    params jsonb NOT NULL DEFAULT '{}'::jsonb,
    title text NOT NULL,
    detail text NOT NULL,
    evidence jsonb NOT NULL,
    evidence_hash text NOT NULL,
    source_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    fact_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    remedy_action text NOT NULL,
    remedy_document_type text,
    status text NOT NULL DEFAULT 'open',
    resolution text,
    dismiss_reason text,
    dismissed_evidence_hash text,
    reopened_count smallint NOT NULL DEFAULT 0,
    decided_by uuid,
    decided_at timestamptz,
    decision_note text,
    assignee_id uuid,
    due_at date,
    first_seen_run_id uuid,
    last_seen_run_id uuid,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_findings_workspace_fingerprint_key UNIQUE (workspace_id, fingerprint),
    CONSTRAINT dossier_findings_kind_check CHECK (kind IN ('contradiction', 'missing', 'expired', 'unsigned', 'outdated', 'unreasonable')),
    CONSTRAINT dossier_findings_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT dossier_findings_origin_check CHECK (origin IN ('rule', 'ai')),
    CONSTRAINT dossier_findings_ai_severity_check CHECK (origin = 'rule' OR severity <> 'critical'),
    CONSTRAINT dossier_findings_remedy_check CHECK (remedy_action IN ('upload', 'draft', 'decide', 'external')),
    CONSTRAINT dossier_findings_status_check CHECK (status IN ('open', 'confirmed', 'dismissed', 'resolved')),
    CONSTRAINT dossier_findings_resolution_check CHECK (resolution IS NULL OR resolution IN ('document', 'draft', 'not_detected', 'manual')),
    CONSTRAINT dossier_findings_resolved_check CHECK ((status = 'resolved') = (resolution IS NOT NULL)),
    CONSTRAINT dossier_findings_dismissed_check CHECK (status <> 'dismissed' OR dismiss_reason IS NOT NULL),
    CONSTRAINT dossier_findings_evidence_check CHECK (jsonb_typeof(evidence) = 'array' AND jsonb_array_length(evidence) BETWEEN 1 AND 8),
    CONSTRAINT dossier_findings_text_check CHECK (char_length(title) <= 200 AND char_length(detail) <= 1000)
);
CREATE INDEX dossier_findings_status_idx ON public.dossier_findings USING btree (workspace_id, status, severity);
CREATE INDEX dossier_findings_dossier_idx ON public.dossier_findings USING btree (dossier_id, status);
CREATE INDEX dossier_findings_sources_idx ON public.dossier_findings USING gin (source_ids);

CREATE TABLE public.dossier_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    dossier_id uuid NOT NULL REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    status text NOT NULL,
    open_count integer NOT NULL DEFAULT 0,
    critical_count integer NOT NULL DEFAULT 0,
    high_count integer NOT NULL DEFAULT 0,
    actual_documents integer NOT NULL DEFAULT 0,
    draft_documents integer NOT NULL DEFAULT 0,
    template_documents integer NOT NULL DEFAULT 0,
    inputs_fingerprint text,
    last_run_id uuid,
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_reviews_dossier_key UNIQUE (dossier_id),
    CONSTRAINT dossier_reviews_status_check CHECK (status IN ('present', 'partial', 'drafted', 'missing', 'template'))
);
CREATE INDEX dossier_reviews_workspace_idx ON public.dossier_reviews USING btree (workspace_id);

CREATE TABLE public.dossier_remedy_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    finding_id uuid NOT NULL REFERENCES public.dossier_findings(id) ON DELETE CASCADE,
    dossier_id uuid REFERENCES public.brain_dossiers(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'generating',
    instructions text,
    title text NOT NULL DEFAULT '',
    document_type text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
    model text,
    error text,
    source_id uuid REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
    requested_by uuid NOT NULL,
    decided_by uuid,
    decided_at timestamptz,
    reject_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dossier_remedy_drafts_status_check CHECK (status IN ('generating', 'proposed', 'approved', 'rejected', 'failed')),
    CONSTRAINT dossier_remedy_drafts_text_check CHECK (char_length(title) <= 200 AND char_length(body) <= 45000 AND (instructions IS NULL OR char_length(instructions) <= 1000))
);
CREATE UNIQUE INDEX dossier_remedy_drafts_one_active ON public.dossier_remedy_drafts (finding_id) WHERE status IN ('generating', 'proposed');
CREATE INDEX dossier_remedy_drafts_workspace_idx ON public.dossier_remedy_drafts USING btree (workspace_id, status, created_at DESC);

-- the updated_at trigger, RLS (app_be select/insert/update/delete with workspace_id IS NOT NULL), REVOKE ALL FROM PUBLIC, anon,
-- authenticated and GRANT SELECT, INSERT, UPDATE, DELETE TO app_be for each of the four tables, exactly as 20261109100218_brain-dossiers.sql does.
```

Entities (`persistence/entities/<table>.entity.ts` of `dossier-review`, each `extends UuidAbstractEntity`, every column
named and typed, `timestamptz`, `uuid` arrays `type: "uuid", array: true`, `due_at` `type: "date"` mapped to `string | null`,
no relations, BE-PERSISTENCE-3); the barrel exports `dossierReviewEntities` and the registry
`platform/database/entities.ts` lists it.

### GraphQL (`features/api/dossier-review`; statuses as strings like `BrainDossierType`)

```graphql
type DossierFindingEvidenceType {
  role: String!
  label: String!
  sourceId: ID
  sourceTitle: String
  passageId: ID
  factId: ID
  factLine: String
  quote: String
}
type DossierFindingParamType {
  name: String!
  value: String!
}
type DossierFindingType {
  id: ID!
  dossierId: ID
  dossierRef: String
  dossierName: String
  relatedDossierIds: [ID!]!
  kind: String!
  severity: String!
  origin: String!
  code: String
  params: [DossierFindingParamType!]!
  title: String!
  detail: String!
  evidence: [DossierFindingEvidenceType!]!
  remedyAction: String!
  remedyDocumentType: String
  status: String!
  resolution: String
  dismissReason: String
  decisionNote: String
  reopenedCount: Int!
  assigneeId: ID
  dueAt: String
  draftId: ID
  draftStatus: String
  firstSeenAt: String!
  lastSeenAt: String!
  resolvedAt: String
  decidedAt: String
  createdAt: String!
  updatedAt: String!
}
type DossierFindingPageInfoType {
  endCursor: String
  hasNextPage: Boolean!
}
type DossierFindingConnectionType {
  nodes: [DossierFindingType!]!
  pageInfo: DossierFindingPageInfoType!
}
input DossierFindingsInput {
  first: Int
  after: String
  dossierId: ID
  statuses: [String!]
  severities: [String!]
  assigneeId: ID
  unassigned: Boolean
  draftsAwaiting: Boolean
}
type DossierReviewType {
  dossierId: ID!
  status: String!
  checklistStatus: String!
  openCount: Int!
  criticalCount: Int!
  highCount: Int!
  reviewedAt: String!
}
type DossierReviewRunType {
  id: ID!
  scope: String!
  dossierId: ID
  trigger: String!
  status: String!
  aiState: String
  opened: Int!
  resolved: Int!
  dropped: Int!
  startedAt: String
  finishedAt: String
  createdAt: String!
}
type DossierReviewSummaryType {
  open: Int!
  confirmed: Int!
  critical: Int!
  high: Int!
  draftsAwaiting: Int!
  isRunning: Boolean!
  latestRun: DossierReviewRunType
  dossiers: [DossierReviewType!]!
}
type DossierDraftPlaceholderType {
  label: String!
  reason: String!
}
type DossierRemedyDraftType {
  id: ID!
  findingId: ID!
  dossierId: ID
  status: String!
  title: String!
  documentType: String!
  body: String!
  placeholders: [DossierDraftPlaceholderType!]!
  error: String
  sourceId: ID
  instructions: String
  rejectReason: String
  decidedAt: String
  createdAt: String!
  updatedAt: String!
}

extend type Query {
  dossierFindings(input: DossierFindingsInput): DossierFindingConnectionType! # sorted severity, then last_seen_at DESC, id DESC; first 1..100, default 50
  dossierReviewSummary: DossierReviewSummaryType!
  dossierRemedyDraft(id: ID!): DossierRemedyDraftType
}
extend type Mutation {
  requestDossierReview(input: RequestDossierReviewInput!): DossierReviewRunType! # { dossierId: ID } null = the whole set
  confirmDossierFinding(input: DossierFindingNoteInput!): DossierFindingType! # { findingId: ID!, note: String ≤ 500 }
  dismissDossierFinding(input: DismissDossierFindingInput!): DossierFindingType! # { findingId: ID!, reason: String! 3..500 }
  reopenDossierFinding(input: DossierFindingRefInput!): DossierFindingType! # { findingId: ID! }
  resolveDossierFinding(input: ResolveDossierFindingInput!): DossierFindingType! # { findingId: ID!, note: String! 3..500 }
  assignDossierFinding(input: AssignDossierFindingInput!): DossierFindingType! # { findingId: ID!, assigneeId: ID, dueAt: String (YYYY-MM-DD) }
  requestDossierRemedyDraft(input: RequestDossierRemedyDraftInput!): DossierRemedyDraftType! # { findingId: ID!, instructions: String ≤ 1000 }
  saveDossierRemedyDraft(input: SaveDossierRemedyDraftInput!): DossierRemedyDraftType! # { draftId: ID!, title: String! 3..160, body: String! 1..40000 }
  approveDossierRemedyDraft(input: DossierRemedyDraftRefInput!): DossierRemedyDraftType! # { draftId: ID! }
  rejectDossierRemedyDraft(input: RejectDossierRemedyDraftInput!): DossierRemedyDraftType! # { draftId: ID!, reason: String ≤ 500 }
}
```

Reads are open to any member; every mutation needs owner or manager. Rule findings' `title` and `detail` are rendered
in the request's locale (`AcceptedLocale`), AI findings as stored. The cursor follows
[list-pagination.md](list-pagination.md) (opaque, versioned, scoped to workspace and filters).

### Jobs and queue

Queue `knowledge` (`modules/queues/knowledge`), two new jobs: `KnowledgeJob.DossierReview = "dossier.review"`
(payload `{ runId, workspaceId }`, dedupe `dossier.review:<runId>`) and `KnowledgeJob.DossierRemedy = "dossier.remedy"`
(payload `{ draftId, workspaceId }`, dedupe `dossier.remedy:<draftId>`), producers `enqueueDossierReview(payload, tx)` and
`enqueueDossierRemedy(payload, tx)`. Processors `features/jobs/review-dossiers` and `features/jobs/draft-dossier-remedy`
(BE-JOBS-4: a `FencedProcessor`, one step that advances the claim then delegates; `onFailed` marks the run or draft
failed). A model failure throws the domain error so the queue retries; a credit block is not an error (the run ends
`done` with `ai_state = skipped_credits`).

## 9. Work packages

Three packages with disjoint files. Interfaces between them are the types of `dossier-review.port.ts` and
`dossier-review.contracts.ts` (written by WP-A exactly as in its brief), the service methods WP-A exports, and the
GraphQL schema of section 8 (written by WP-B, consumed by WP-C).

| WP             | owns                                                                                                                                                                                   | depends on                                                                                             | integration |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| A Core         | migration, entities, `modules/domain/dossier-review`, the owner reads it needs (knowledge-sources, knowledge-chunks, brain-facts), queue contracts, the entity registry line           | the dossier work of `brain-dossiers` being committed                                                   | first       |
| B AI and doors | `modules/domain/dossier-review-ai`, the two jobs, `features/api/dossier-review`, the hook in `DocumentFactsService`, compose wiring of all three modules, the emitted GraphQL contract | WP-A's exports (codes against the port from the start; verifies once WP-A is committed)                | second      |
| C Front end    | the blocks, hooks, operations, copy and the page edits                                                                                                                                 | WP-B's emitted `be/contracts/api/schema.graphql` for codegen (writes against section 8 from the start) | third       |

Each brief below is complete; paste it as the whole prompt of a fresh agent.

### Brief WP-A: dossier review core (back end)

```text
You build WP-A "dossier review core" of the nivo-lite Second Brain. The design is
D:/starci-lanes/nivo-lite/be/docs/guides/dossier-review.md: read it whole first; it is approved by the owner and you
build it without asking the owner anything. Where the design is silent, choose the option closest to the existing
brain-dossiers and brain modules and write the choice in your final report.

Read before planning: D:/.claude/contexts/README.md (load order), harness/rules.md, then the BE canon
D:/.claude/contexts/code/be/{architecture,domain,services,persistence,queues,jobs,error,messages,naming,typing,test}.md,
code/shared/{test,typing,naming,comment}.md. Read as templates: be/src/modules/domain/brain-dossiers/** (module,
options, errors, messages, entity, specs), be/src/modules/domain/brain/document-facts.service.ts (credits, usage,
eachInOrder), be/src/modules/queues/knowledge/**, be/src/modules/domain/knowledge-sources/source-categories.service.ts
(REF_EXPRESSION: the dossier ref of a source), db/migrations/20261109100218_brain-dossiers.sql. Read the data set's
workbooks to transcribe the rule pack: D:/starci-tmp/nivo-data/raw-1793388658/NIVO_Dữ liệu đã chuẩn hóa/"00. BẢNG ĐỐI
CHIẾU VÀ HỒ SƠ CÒN THIẾU.xlsx" (sheet "Tình trạng 64 hồ sơ") and "00. RÀ SOÁT PHÁP LÝ CUỐI - 27-10-2026.xlsx" (sheets
"Kết luận từng hồ sơ", "Đối soát chéo", "Căn cứ pháp luật"); read them with python -I and openpyxl (read_only,
data_only) from a script in your scratchpad, never from inside that folder. No company-specific value (names, tax
code, amounts, dates, account numbers) goes into code or specs: specs use synthetic data.

Goal: everything of the design except the model calls, the job processors, the GraphQL doors and the front end.

Files you create:
- db/migrations/<stamp>_dossier-review.sql via `npm run db:new -- dossier-review`, exactly section 8 of the design,
  plus the set_updated_at trigger, RLS policies, REVOKE and GRANT for each of the four tables as the brain-dossiers
  migration does.
- be/src/modules/domain/dossier-review/: dossier-review.contracts.ts (kinds, severities, statuses, resolutions, remedy
  actions, the caps of section 3 as named constants, record and input types), dossier-review.port.ts,
  dossier-review.decorators.ts (DOSSIER_REASONER, REMEDY_WRITER tokens and their Inject decorators),
  dossier-review.module-definition.ts, dossier-review.module.ts, dossier-review.options.ts
  ({ reasoner: Type<DossierReasoner>; writer: Type<RemedyWriter> }), dossier-review.log-events.ts,
  errors/dossier-review.error.ts (codes: FindingNotFound, DraftNotFound, TransitionRefused, ReasonRequired,
  AssigneeNotMember, DraftDailyLimit, NothingToReview, ModelUnavailable), messages/dossier-review.messages.ts (vi and
  en: the error texts and every rule finding's `findings.<code>.title` / `findings.<code>.detail` with {{params}}),
  persistence/entities/{dossier-review-run,dossier-finding,dossier-review,dossier-remedy-draft}.entity.ts + index.ts
  (dossierReviewEntities), dossier-pack.policy.ts (pack vn-llc-64@1, section 4), document-state.policy.ts (ref of a
  source mirroring REF_EXPRESSION in TypeScript, document state, document date), review-bundle.policy.ts (keys S/P/F/C/K/A,
  caps, the bundle text of section 5), one policy per rule family: presence.policy.ts, signatures.policy.ts,
  expiry.policy.ts, amounts.policy.ts, outdated.policy.ts, roles.policy.ts, facts-conflict.policy.ts,
  identifiers.policy.ts, citations.policy.ts, values.policy.ts; rule-engine.policy.ts (runs them: candidates + coverage),
  evidence.policy.ts (section 5 guard, for rule and AI candidates), fingerprint.policy.ts, reconcile.policy.ts (stored
  findings + verified candidates + coverage → inserts, updates, reopenings, resolutions; AI findings follow rule 4 of the
  guard), dossier-status.policy.ts (section 6), finding-record.mapper.ts, review-inputs.service.ts (collects the dossier
  inputs through the owners' read services, sequentially with eachInOrder), dossier-review-runs.service.ts
  (requestForSource, requestForGoneSource, request(userId, workspaceId, dossierId | null): coalesced row + outbox in one
  transaction), dossier-review-runner.service.ts (run(payload), fail(payload): claim, rules, AI through the port with
  the credits gate and the caps, guard, reconcile, statuses, stats), dossier-findings.service.ts (list with the
  connection cursor, summary, confirm, dismiss, reopen, resolve, assign; locale-rendered titles for rule findings),
  dossier-remedy-drafts.service.ts (request, generate(payload) through the port, fail(payload), get, save, approve,
  reject; approval through KnowledgeSourcesService.addSource as the approving user, idempotent by the
  `remedy:<draftId>` tag), index.ts. A spec beside every logic file.
- be/src/modules/domain/knowledge-sources/dossier-sources.service.ts (+ .spec.ts) and dossier-sources.contracts.ts:
  `sourcesOfTopics(workspaceId, topics, limit)` (id, title, topic, tags, origin, kind, status, chunkCount, sizeBytes,
  updatedAt, createdAt; bounded) and `byTag(workspaceId, tag)` (first match or null).
- Edits: knowledge-chunks/knowledge-chunks.service.ts + spec: `passagesOfSources(workspaceId, sourceIds, perSource)`
  (one bounded query, ordered by source then order); brain-facts/brain-facts-read.service.ts + spec:
  `ofSources(workspaceId, sourceIds, statuses, limit)` (facts whose evidence cites any of the sources, one bounded
  query) and export BrainFactsReadService from brain-facts.module.ts and index.ts; queues/knowledge/knowledge.contracts.ts
  and knowledge.queue.ts (+ specs): KnowledgeJob.DossierReview / DossierRemedy, payload types and guards, the two
  producers; knowledge-sources.module.ts and index.ts (provide and export DossierSourcesService);
  platform/database/entities.ts (dossierReviewEntities). You do not edit be/apps/api/src/compose: the module's options
  name WP-B's two services, so WP-B registers DossierReviewModule (after BrainDossiersModule, with
  DOSSIER_REVIEW_ERROR_KINDS and DOSSIER_REVIEW_MESSAGES registered the way BRAIN_DOSSIERS_* are) together with its own
  modules. Your specs build the module's services with fakes of the two ports.

Port (write exactly; WP-B implements it):
  export interface BundleItem { readonly key: string; readonly text: string }
  export interface DossierBundle {
      readonly workspaceId: string; readonly today: string; readonly packVersion: string
      readonly dossier: { readonly ref: string; readonly name: string; readonly category: string; readonly requirement: string;
                          readonly basis: ReadonlyArray<string> }
      readonly checklist: BundleItem | null
      readonly related: ReadonlyArray<{ readonly ref: string; readonly name: string }>
      readonly documents: ReadonlyArray<{ readonly key: string; readonly title: string; readonly state: string;
                                          readonly date: string | null; readonly passages: ReadonlyArray<BundleItem> }>
      readonly facts: ReadonlyArray<BundleItem>
      readonly known: ReadonlyArray<BundleItem>
      readonly openAi: ReadonlyArray<BundleItem>
  }
  export interface CitedQuote { readonly key: string; readonly quote: string }
  export interface ReasonedFinding { readonly kind: string; readonly severity: string; readonly title: string;
      readonly detail: string; readonly evidence: ReadonlyArray<CitedQuote>; readonly relatedRefs: ReadonlyArray<string>;
      readonly remedyAction: string; readonly documentType: string | null }
  export interface ReasonedReview { readonly findings: ReadonlyArray<ReasonedFinding>;
      readonly stillOpen: ReadonlyArray<{ readonly key: string; readonly applies: boolean; readonly evidence: ReadonlyArray<CitedQuote> }>;
      readonly model: string; readonly promptTokens: number | null; readonly completionTokens: number | null }
  export interface DossierReasoner { review(bundle: DossierBundle): Promise<ReasonedReview | null> }
  export interface RemedyRequest { readonly workspaceId: string; readonly today: string;
      readonly finding: { readonly kind: string; readonly severity: string; readonly title: string; readonly detail: string;
                          readonly evidence: ReadonlyArray<{ readonly label: string; readonly quote: string | null }> };
      readonly dossier: { readonly ref: string; readonly name: string; readonly category: string };
      readonly remedy: { readonly documentType: string | null; readonly guidance: string | null };
      readonly identity: ReadonlyArray<string>; readonly instructions: string | null }
  export interface RemedyText { readonly title: string; readonly documentType: string; readonly body: string;
      readonly placeholders: ReadonlyArray<{ readonly label: string; readonly reason: string }>; readonly model: string }
  export interface RemedyWriter { draft(request: RemedyRequest): Promise<RemedyText | null> }
The port answers null when the model is unavailable or its answer did not parse after its own retry; the runner then
sets ai_state "failed" for that dossier (rule findings are still saved) and the drafts service marks the draft failed.
The implementations record usage themselves; the core calls UsageMeterService.blockedBy before each call and counts the
daily caps from its own tables. The draft body gets the fixed tail of section 6 appended by the core, not by the port.

Exports of index.ts (WP-B imports exactly these): DossierReviewModule, DossierReviewRunsService,
DossierReviewRunnerService, DossierFindingsService, DossierRemedyDraftsService, dossierReviewEntities,
DOSSIER_REVIEW_ERROR_KINDS, DOSSIER_REVIEW_MESSAGES, the port types, DOSSIER_REVIEW_CAPS, the kind / severity /
status / remedy enums as const arrays, and the record types the GraphQL mappers read (FindingRecord, FindingPage,
ReviewSummary, ReviewRunRecord, RemedyDraftRecord) shaped like section 8's GraphQL types. Service signatures:
  runs.requestForSource(workspaceId, sourceId): Promise<void>
  runs.requestForGoneSource(workspaceId, sourceId, topic: string | null, title: string): Promise<void>
  runs.request(userId, workspaceId, dossierId: string | null): Promise<ReviewRunRecord>
  runner.run(payload: object): Promise<"done" | "skipped">; runner.fail(payload: object): Promise<void>
  findings.list(userId, workspaceId, filter, locale): Promise<FindingPage>
  findings.summary(userId, workspaceId): Promise<ReviewSummary>
  findings.confirm / dismiss / reopen / resolve / assign(userId, workspaceId, input, locale): Promise<FindingRecord>
  drafts.request(userId, workspaceId, findingId, instructions): Promise<RemedyDraftRecord>
  drafts.generate(payload: object): Promise<"done" | "skipped">; drafts.fail(payload: object): Promise<void>
  drafts.get / save / approve / reject(userId, workspaceId, ...): Promise<RemedyDraftRecord | null or RemedyDraftRecord>

Tests: unit specs for every logic file at 100 % lines, branches, functions and statements per file (BE-TEST-5, 9, 13,
16: builders for test data, exact values). The acceptance set A1 to A4 of the design is a spec of rule-engine.policy.ts
with synthetic facts and sources that reproduce each case, plus the negative of each (charter dated after the transfer,
equal amounts, CCCD present, roles not overlapping). evidence.policy.spec covers each drop reason. reconcile.policy.spec
covers insert, update in place, reopen after dismissal with new evidence, stay dismissed with the same evidence,
not_detected resolution only inside coverage, AI findings never resolved by absence. Run only your specs:
cd be && npx jest --selectProjects unit --coverage --collectCoverageFrom='<each logic file you changed>' <their specs>.
Also run npm run typecheck and npx starci app lint (or npm run lint) and fix everything they report in your files.

Done when: the migration is tested on a copy and applied locally; entities match the migrated schema (run
`npx starci app db drift` if your CLI offers it); all your specs pass at 100 % per file; typecheck and lint are clean;
everything is committed; your report lists the commit hashes, each decision you made where the design was silent, and
any shared file you could not commit.

Repo rules (hard, no exception):
- Repo D:/starci-lanes/nivo-lite on main. Other agents edit this checkout at the same time. Never git add -A, commit -a,
  stash, checkout -- <file>, restore, reset --hard, clean, rebase or push; never touch a file outside your list.
- Commit path-limited through a temporary index, in Git Bash:
    export GIT_INDEX_FILE="$(mktemp -u)"; git read-tree HEAD
    git add -- <only your files>
    git commit -F "$MSG"    # MSG="$(mktemp -u)" holds the message: a short path, the scratchpad path is too long for git on Windows; hooks run, never --no-verify
    rm -f "$GIT_INDEX_FILE"; unset GIT_INDEX_FILE
    git reset -q -- <the same files>     # re-syncs the real index for exactly those paths
  A shared file that already holds someone else's uncommitted change (git diff shows hunks you did not write): save
  your own change as a patch against the file as it was before your edit, and in the temporary index apply only it
  (git apply --cached <patch>); if it does not apply, leave that file uncommitted and name it in the report. Commit
  messages: conventional (feat(be): …), the reason in the body, last line the Co-Authored-By trailer your session's
  attribution instructions give.
- Start condition: db/migrations/20261109100218_brain-dossiers.sql and be/src/modules/domain/brain-dossiers are
  committed (git log --oneline -1 -- <path>). If not, build your new files first and touch the shared files last;
  wait for that commit with a Monitor until-loop, never a foreground sleep.
- No eslint-disable, @ts-ignore, @ts-expect-error, `as` casts (only `as const`), `any`, non-null `!` on values, skipped
  or focused tests, coverage ignores, --no-verify. Narrow with type guards, as the codebase does.
- Never open, read, print or grep *.enc*, secrets.env, any *.env or .env* file, or .secrets/; never print the
  environment.
- Migrations: forward only; never edit a committed one. Test on a copy first, then apply to the local database:
    docker exec nivo-local-db createdb -U postgres nivo_review_copy
    docker exec nivo-local-db sh -c "pg_dump -U postgres --schema-only --no-owner postgres | psql -q -U postgres -d nivo_review_copy"
    docker exec -i nivo-local-db psql -v ON_ERROR_STOP=1 -U postgres -d nivo_review_copy < db/migrations/<file>.sql
    (check \d of the four tables, insert and update one row per table, try one row per CHECK that must fail)
    docker exec nivo-local-db dropdb -U postgres nivo_review_copy
    docker exec -i nivo-local-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < db/migrations/<file>.sql
- The local api (port 18787) and web (port 3100) are running: never start, stop, restart or kill them or any node
  process; no npm run dev:*.
- Back end only in this WP; the front end has no tests (SHARED-TEST-1).
```

### Brief WP-B: dossier review AI layer, jobs and GraphQL (back end)

```text
You build WP-B "dossier review AI and doors" of the nivo-lite Second Brain. The design is
D:/starci-lanes/nivo-lite/be/docs/guides/dossier-review.md: read it whole first; it is approved by the owner and you
build it without asking the owner anything. Where the design is silent, choose the option closest to the existing
code and write the choice in your final report. WP-A builds the core module be/src/modules/domain/dossier-review in
parallel; its port, exports and service signatures are fixed in the WP-A brief inside the design (section 9): code
against them exactly, and import only from "@modules/domain/dossier-review".

Read before planning: D:/.claude/contexts/README.md (load order), harness/rules.md, then
D:/.claude/contexts/code/be/{ai,architecture,domain,services,jobs,queues,transport,api,api-auth,error,messages,naming,
typing,test}.md and code/shared/{test,typing,naming,comment}.md. Templates: be/src/modules/domain/brain/document-facts.service.ts
and extraction.policy.ts (how a domain service calls AiService.chat, parses JSON, records usage), be/src/modules/domain/
ai-tasks/ai-tasks.schema.ts (zod schemas), be/src/features/jobs/extract-knowledge-facts/** (a job), be/src/features/api/
knowledge/** (resolvers, handlers, commands, queries, mappers, DTOs; brain-dossiers.* and request-lesson-mining.* are
the closest), be/docs/guides/list-pagination.md and a connection feature it names, be/apps/api/src/compose/*.ts.

Files you create:
- be/src/modules/domain/dossier-review-ai/: module files (module-definition, module, options if needed), index.ts,
  dossier-reasoner.service.ts implementing DossierReasoner (prompt of section 5, AiService.chat with json true and the
  zod schema, timeout 60 s, one retry when the answer does not parse, usage recorded with kind "brain" and module
  "dossier_review", answers null when the model is unavailable or the retry fails), remedy-writer.service.ts implementing
  RemedyWriter (section 6, timeout 90 s, same retry and usage rules), dossier-review-prompt.policy.ts (system prompt,
  the bundle rendered as the text of section 5 with its keys, PROMPT_VERSION "dossier-review@1"),
  remedy-prompt.policy.ts, dossier-review.schema.ts and remedy.schema.ts (zod, bounded exactly as the design),
  reasoned.mapper.ts (parsed answer → ReasonedReview / RemedyText, trimming to the bounds), errors/ and messages/ if you
  add codes; a spec beside every logic file.
- be/src/features/jobs/review-dossiers/** and be/src/features/jobs/draft-dossier-remedy/** (BE-JOBS-4: FencedProcessor
  with queue KNOWLEDGE_QUEUE and job KnowledgeJob.DossierReview / DossierRemedy, one step that advances the claim then
  calls runner.run / drafts.generate; onFailed calls runner.fail / drafts.fail).
- be/src/features/api/dossier-review/** : the feature module, its GraphQL module, one resolver + mapper per operation
  of section 8, the queries and commands with their handlers and contracts, DTOs (ObjectType, InputType with
  class-validator bounds exactly as section 8), the connection cursor as list-pagination.md describes. Resolvers take
  @CurrentPrincipal, @WorkspaceId and @AcceptedLocale and go through the query / command bus like the knowledge feature.
- Edits: be/src/modules/domain/brain/document-facts.service.ts and its spec: after `finish` reads a document and after
  `giveUp`, call DossierReviewRunsService.requestForSource(workspaceId, sourceId); in `withdraw`, call
  requestForGoneSource(workspaceId, sourceId, null, title); a failure there is logged (a new BrainLogEvent) and never
  fails the facts job. brain.module.ts only if a provider must be added. be/apps/api/src/compose/*.ts: register
  DossierReviewAiModule and DossierReviewModule in compose/knowledge.ts after BrainDossiersModule
  (DossierReviewModule.register({ isGlobal: true, reasoner: DossierReasonerService, writer: RemedyWriterService }),
  with DOSSIER_REVIEW_ERROR_KINDS and DOSSIER_REVIEW_MESSAGES registered the way BRAIN_DOSSIERS_* are), the two job
  queue modules where the other knowledge jobs are, the api feature where the knowledge feature is. Then regenerate the contract: npm run contract:emit (be/contracts/api/
  schema.graphql) and commit it.

Tests: unit specs for every logic file of dossier-review-ai at 100 % per file (BE-TEST-5, 9, 13, 16) with a fake
AiService (the kit's doubles, BE-TEST-4): the prompt holds every key of the bundle and nothing else, a parse failure
retries once then answers null, an unavailable model answers null without a retry, usage is recorded once per call with
the exact numbers, the mapper trims every bound. document-facts.service.spec covers the three new calls and their
failure. The features tier is thin and unmeasured (BE-TEST-7): keep logic out of it. Run only your specs:
cd be && npx jest --selectProjects unit --coverage --collectCoverageFrom='<each logic file you changed>' <their specs>.
Then npm run typecheck and npx starci app lint (or npm run lint); fix everything in your files.

Acceptance on data, when the running api has picked up the build by itself (watch mode) and the local workspace holds
the reference data set: request a whole-set review through GraphQL on http://localhost:18787 as an owner session you
already have (never create accounts or type passwords), wait for the run, and list the findings: A1 to A4 of the
design must be among them. If the api has not reloaded or the data is not there, say so in the report; do not restart
anything.

Done when: your specs pass at 100 % per file, typecheck and lint are clean, schema.graphql is emitted with exactly the
section 8 operations, everything is committed, and your report lists the commit hashes, the decisions you made, the
acceptance result, and the prompt text as committed.

Start and order: begin at once with your new files; before you run typecheck or commit, WP-A's module must be committed
(git log --oneline -1 -- be/src/modules/domain/dossier-review); wait for it with a Monitor until-loop, never a
foreground sleep. If WP-A's committed exports differ from the brief, follow the committed code and note the difference.

Repo rules (hard, no exception):
- Repo D:/starci-lanes/nivo-lite on main. Other agents edit this checkout at the same time. Never git add -A, commit -a,
  stash, checkout -- <file>, restore, reset --hard, clean, rebase or push; never touch a file outside your list.
- Commit path-limited through a temporary index, in Git Bash:
    export GIT_INDEX_FILE="$(mktemp -u)"; git read-tree HEAD
    git add -- <only your files>
    git commit -F "$MSG"    # MSG="$(mktemp -u)" holds the message: a short path, the scratchpad path is too long for git on Windows; hooks run, never --no-verify
    rm -f "$GIT_INDEX_FILE"; unset GIT_INDEX_FILE
    git reset -q -- <the same files>     # re-syncs the real index for exactly those paths
  A shared file that already holds someone else's uncommitted change: save your own change as a patch against the file
  as it was before your edit and apply only it in the temporary index (git apply --cached <patch>); if it does not
  apply, leave that file uncommitted and name it in the report. Commit messages: conventional (feat(be): …), the reason
  in the body, last line the Co-Authored-By trailer your session's attribution instructions give.
- No eslint-disable, @ts-ignore, @ts-expect-error, `as` casts (only `as const`), `any`, non-null `!` on values, skipped
  or focused tests, coverage ignores, --no-verify. Narrow with type guards; parse model answers with the zod schema.
- Never open, read, print or grep *.enc*, secrets.env, any *.env or .env* file, or .secrets/; never print the
  environment; never put a key or token in code, specs or commands.
- No migration in this WP (WP-A owns the schema). Should you need one anyway: test it on a copy first exactly as the
  WP-A brief shows, then apply it locally with docker exec -i nivo-local-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres.
- The local api (port 18787) and web (port 3100) are running: never start, stop, restart or kill them or any node
  process; no npm run dev:*.
```

### Brief WP-C: dossier review on the Second Brain page (front end)

```text
You build WP-C "dossier review UI" of the nivo-lite Second Brain page (fe/apps/web). The design is
D:/starci-lanes/nivo-lite/be/docs/guides/dossier-review.md: read it whole first, sections 2, 6, 7 and 8 closely; it is
approved by the owner and you build it without asking the owner anything. Where the design is silent, follow the
existing Second Brain blocks and write the choice in your final report. WP-B emits the GraphQL contract of section 8 in
be/contracts/api/schema.graphql; write your operations against section 8 from the start.

Read before planning: D:/.claude/contexts/README.md (load order), harness/rules.md, D:/.claude/contexts/code/fe/{README,
architecture,boundaries,folder,data,form,i18n,ui,error,naming,typing,transport}.md, code/shared/{test,typing,naming,
comment}.md, D:/.claude/contexts/ui/{README,composition,presentation}.md and ui/components/{pane-grid,list-table,
dialog-drawer,segmented-control,select,text-field,toast-alert,empty-state,button,chip}.md, grammars/core.md (or the
grammar hfs.json names). Templates: fe/apps/web/src/components/blocks/{BrainDossiers,BrainReview,BrainGaps,KnowledgeAdd}/**,
features/pages/BrainPage/**, components/blocks/BrainPageFrame/**, hooks/brain/**, hooks/swr/api/graphql/**,
modules/api/graphql/{queries,mutations}/**, modules/brain/**, modules/routes/knowledge-routes.ts,
app/[locale]/(console)/brain/page.tsx, modules/i18n/messages/{vi,en}.json, fe/i18n-dynamic-keys.yaml. Use only
@starci/grammar/common components (0.16.3); no new primitive, no raw HTML control, no inline style.

Files you create:
- modules/api/graphql/queries/query-dossier-findings.ts, query-dossier-review-summary.ts, query-dossier-remedy-draft.ts;
  modules/api/graphql/mutations/mutation-{request-dossier-review,confirm-dossier-finding,dismiss-dossier-finding,
  reopen-dossier-finding,resolve-dossier-finding,assign-dossier-finding,request-dossier-remedy-draft,
  save-dossier-remedy-draft,approve-dossier-remedy-draft,reject-dossier-remedy-draft}.ts.
- hooks/swr/api/graphql/queries/useQueryDossierFindingsSwr.ts (connection, Load more), useQueryDossierReviewSummarySwr.ts
  (refreshInterval 4 s while isRunning, else 0), useQueryDossierRemedyDraftSwr.ts (4 s while generating, else 0);
  hooks/swr/api/graphql/mutations/useMutate<Operation>Swr.ts for the ten mutations.
- hooks/brain/useDossierFindings.ts, useDossierReviewSummary.ts, useDossierReviewCommands.ts (FE-DATA-COMMAND: one
  domain command hook; each write toasts through useGraphQLWithToast and revalidates exactly the findings, summary,
  draft and, after an approval, the dossiers and knowledge reads), useDossierRemedyDraft.ts.
- modules/brain/findings.ts: severity, kind and status tones and order, filter values, view mappers (pure functions).
- components/blocks/DossierFindings/{index.tsx,component.tsx,classNames.ts} (the detail pane of one dossier),
  components/blocks/DossierTodo/** (the "Cần xử lý" tab), components/blocks/DossierRemedyDraft/** (the draft drawer),
  components/composites/DossierFindingRows/** (rows shared by both lists), components/composites/DossierFindingDialogs/**
  (dismiss, assign, mark done: Dialog with a form, footer commit type="submit" form=<id>).
- Edits: components/blocks/BrainDossiers/{component.tsx,index.tsx,classNames.ts} (selectable dossier rows, the
  recomputed status badge with the checklist status beside it when they differ, the worst-severity count badge, the
  "Rà soát lại cả bộ" header action for owners and managers, the third `detail` pane collapse="drawer" of section 7);
  features/pages/BrainPage/component.tsx (the todo panel); modules/routes/knowledge-routes.ts (BRAIN_TABS gains "todo"
  after "dossiers"; the dossier, finding and draft parameters); modules/brain/tabs.ts and index.ts; the brain page
  route if it must pass the new parameters; components/blocks/BrainPageFrame (the tab label with its count);
  KnowledgeAdd's preset and its hook so the upload action can preset the topic and the tag dossier:<ref> (add a `tags`
  field to the preset and pass it into the add mutation); hooks/brain/index.ts, hooks/swr index files;
  modules/i18n/messages/vi.json and en.json (namespace dossierReview, the copy table of section 7, same keys in both);
  fe/i18n-dynamic-keys.yaml for every key family built at run time (severity_*, kind_*, resolution_*), each with its
  reason in the file's format.

Behaviour: section 7. Members read everything and see no write action (useWorkspaceMember().canWrite). The assignee
Select lists the workspace members from the existing useQueryWorkspaceMembersSwr. Rule and AI findings show title and
detail as the API returns them (the API already localises rule findings); only labels, badges and actions come from
your catalog. Dates through the app's formatting owner (FE-I18N-5). Loading uses the blocks' skeleton placeholders
through SlotView; empty states use EmptyNotice with the design's copy.

Tests: the front end has no tests (SHARED-TEST-1). Prove it with npm run codegen, npm run typecheck and npx starci app
lint (or npm run lint): all clean for your files. Then look at the page: the web app runs on http://localhost:3100;
open /brain?tab=dossiers and /brain?tab=todo in the browser pane (signed-in session already there; never type
passwords or create accounts), at a wide and a phone width; check the detail pane, the drawer at narrow width, the
dialogs, and the draft drawer when a draft exists. Do not restart the web server; if it has not reloaded your code, say
so in the report.

Done when: codegen, typecheck and lint are clean; the screens behave as section 7 at wide and narrow widths; vi and en
hold the same keys; everything is committed; your report lists the commit hashes, the decisions you made and what you
could not see in the running app.

Start and order: begin at once with the operations, hooks, modules and blocks against section 8; before codegen,
typecheck or commit, WP-B's contract must be committed (git log --oneline -1 -- be/contracts/api/schema.graphql shows
a commit naming dossier review), and the dossier work of BrainDossiers must be committed (git status --short on
components/blocks/BrainDossiers is clean of changes you did not make); wait with a Monitor until-loop, never a
foreground sleep. If the emitted schema differs from section 8, follow the schema and note the difference.

Repo rules (hard, no exception):
- Repo D:/starci-lanes/nivo-lite on main. Other agents edit this checkout at the same time. Never git add -A, commit -a,
  stash, checkout -- <file>, restore, reset --hard, clean, rebase or push; never touch a file outside your list.
- Commit path-limited through a temporary index, in Git Bash:
    export GIT_INDEX_FILE="$(mktemp -u)"; git read-tree HEAD
    git add -- <only your files>
    git commit -F "$MSG"    # MSG="$(mktemp -u)" holds the message: a short path, the scratchpad path is too long for git on Windows; hooks run, never --no-verify
    rm -f "$GIT_INDEX_FILE"; unset GIT_INDEX_FILE
    git reset -q -- <the same files>     # re-syncs the real index for exactly those paths
  A shared file that already holds someone else's uncommitted change (vi.json, en.json, the index files): save your
  own change as a patch against the file as it was before your edit and apply only it in the temporary index
  (git apply --cached <patch>); if it does not apply, leave that file uncommitted and name it in the report. Commit
  messages: conventional (feat(web): …), the reason in the body, last line the Co-Authored-By trailer your session's
  attribution instructions give.
- No eslint-disable, @ts-ignore, @ts-expect-error, `as` casts (only `as const`), `any`, non-null `!` on values,
  --no-verify. Narrow with type guards; display text only from the message catalogs (FE-I18N-2).
- Never open, read, print or grep *.enc*, secrets.env, any *.env or .env* file, or .secrets/; never print the
  environment.
- No migration in this WP. Should one be needed: test it on a copy first exactly as the WP-A brief shows, then apply it
  locally with docker exec -i nivo-local-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres.
- The local api (port 18787) and web (port 3100) are running: never start, stop, restart or kill them or any node
  process; no npm run dev:*.
```

## 10. Decided by default (no owner question)

- Drafts are approved on the page by an owner or manager, not through `approval_requests`: those belong to work-chain
  steps with amounts and approver groups; a dossier draft has neither.
- The checklist import does not start a review by itself (it would spend AI on 64 dossiers unasked); the page offers it.
- A finding of a dossier the checklist no longer names is deleted with the dossier (cascade), like the dossier itself.
- MCP / agent tools over findings, notifications (Zalo, email) on new critical findings, and a schedule that re-checks
  expiry dates daily are left for a later release; the expiry rule runs on every review.
