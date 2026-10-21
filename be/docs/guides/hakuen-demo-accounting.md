# HAKUEN demo: the accounting agent's morning desk

PLAN v5 items N14 (tax calendar), N15 (daily summary card), N16 (e-invoice checks) and N23 (folio matching). The logic extends
the existing accounting capability `be/src/modules/domain/accounting`; the morning job is
`be/src/features/jobs/run-accounting-morning` on the queue `be/src/modules/queues/accounting-desk`, scheduled by
`supabase/migrations/20261101000500_accounting-desk.sql` (pg_cron `accounting-desk-morning`, 23:30 UTC = 06:30 in Vietnam) and
declared in `.starcistacks/application-stacks.yaml` and `be/src/modules/domain/job-ops/job-tick.policy.ts`.

## Data layers

- **MCP gateway (live data).** The desk never reads a source itself. `be/src/modules/domain/accounting/accounting-gateway.port.ts`
  names what it needs: `einvoice.list` (invoices received since a moment, and the unpaid ones), `sepay.transactions.list`,
  `hakuen.folio.get` (by transfer memo) and `hakuen.folio.recordPayment`. The app root binds an adapter through
  `AccountingModule.register({ gateway })`; until then `be/src/modules/domain/accounting/unwired-accounting-gateway.service.ts` answers that nothing is there.
- **Second Brain.** The tax profile is the active facts of subject `tax_profile` (`tax_code`, `vat_period`, `withholds_pit`,
  `pays_license_fee`, `established_year`, `reminder_days`, `supplier_term_days`); suppliers on file are the subjects
  `supplier:<slug>` (`name`, `tax_code`, `term_days`). See `be/src/modules/domain/accounting/tax-profile.policy.ts`. The workspace seed writes them.
- **NIVO base knowledge.** The deadline rules (Law on Tax Administration 38/2019 art. 44, Decree 126/2020, Decree 91/2022) are
  logic in `be/src/modules/domain/accounting/tax-calendar.policy.ts`; the public holiday dates are data in `be/src/modules/domain/accounting/vn-holidays.contracts.ts` (2027 is provisional).
- Every card records its sources in `data.sources`.

## Morning run, per workspace with the accounting module

1. Read the tax profile and suppliers from the Second Brain; skip the workspace when there is no tax code.
2. Read the last day's e-invoices through the gateway and check them (`be/src/modules/domain/accounting/einvoice-checks.policy.ts`): seller tax code format and
   check digit, seller tax code against the supplier on file, buyer tax code, lines against subtotal, VAT against the line rates,
   total. Anything not valid becomes an `exception` card in the accounting room.
3. Read the last day's bank credits; each unmatched credit whose memo carries `HAKUEN XXXXXX` is matched against the folio
   (`be/src/modules/domain/accounting/receivable-reconcile.service.ts`): an exact payment is recorded with `folio.recordPayment`, any other amount becomes an
   `exception` card.
4. Compute the upcoming dues (tax deadlines and supplier payments within 30 days), post the `daily_summary` card, and post a
   reminder line for each due at the lead day, the day before and the day itself.

## Shortcuts and open gaps (DEMO-NOTES)

| Item                | State                                                                                                                                                  | To finish                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway adapter     | Port and unwired default only; the gateway lives on `demo/sales`.                                                                                      | Bind an adapter that calls `McpGatewayService.call` for the five tools. The e-invoice reading (TT78 XML parser) was handed to the gateway worker as the `einvoice` native adapter: `D:/starci-tmp/nivo-demo/handoff/einvoice-adapter`. |
| `folio.get` by memo | hakuen-mcp@1 `folio.get` takes `{ stayId }`.                                                                                                           | HAKUEN adds a lookup by `transferRef`, or NIVO keeps a memo-to-stay map from the `booking.confirmed` webhook.                                                                                                                          |
| Hub cards           | Payloads follow hub-cards v1; `be/src/modules/domain/accounting/accounting-room.service.ts` posts the text fallback as a line of the accounting agent. | After `demo/hub` is merged, post through `OfficeCardsService.post({ room: "accounting", card })`.                                                                                                                                      |
| Exception decisions | Info cards (no `ref`), so no approve or decline buttons yet.                                                                                           | Open a work item per exception and pass `ref: { kind: "work_item" }` with actions.                                                                                                                                                     |
| Idempotency         | No table: one cron run per day posts once; a manual replay of the tick posts again.                                                                    | Keep a per-day marker if replays matter.                                                                                                                                                                                               |
| PDF invoices        | Not handled on the desk; belongs to the gateway adapter.                                                                                               | unpdf text and LLM field extraction in the adapter.                                                                                                                                                                                    |
| Copy                | Vietnamese only (the room language).                                                                                                                   | English copy when a workspace runs in English.                                                                                                                                                                                         |
| Specs               | Specs exist for the policies and services, but the owner moved coverage after the feature work; see the commit message for the debt list.              | Run the specs at 100 percent.                                                                                                                                                                                                          |
