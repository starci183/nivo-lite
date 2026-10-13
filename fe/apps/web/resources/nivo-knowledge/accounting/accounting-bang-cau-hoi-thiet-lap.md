---
title: Accounting setup questionnaire
kind: setup_checklist
version: 1
---

# Accounting setup questionnaire

Accounting should only go live once the owner has confirmed the information for all six items below. Before asking, check Business Knowledge (payment policies, price lists, legal information) and summarize what is already available instead of asking for it again.

## scope — Scope of work

Required: which tasks AI Accounting handles (drafting invoices, reconciling payments, sending payment reminders, reporting) and which tasks are left to people.
Complete when: there is a list of assigned tasks and tasks left to people.

## currency_tax — Currency and tax

Required: currency (usually VND), applicable VAT and how it is presented (whether prices include or exclude tax), rounding rules, and whether the business issues electronic invoices.
Complete when: the tax rate or its non-applicable status and the rounding rules are specified. Do not guess the tax rate.

## source_evidence — Sources of supporting evidence

Required: where the data comes from (orders from Sales, bank statements or notifications, attachments), which source is primary, and how often it is updated.
Complete when: there is at least one payment source and a way to match payments to orders (the order code in the transfer description).

## approval_policy — Approval policy and thresholds

Required: which amounts Accounting can handle independently, which require the owner's approval, who approves, and any exceptions.
Complete when: there is a threshold in VND and an approver.

## evidence_requirements — Supporting documentation requirements

Required: what supporting documentation is needed before issuing an invoice (name, tax identification number, address, line items) and before recording a payment.
Complete when: there is a list of required supporting documentation for each step.

## prohibited_actions — Prohibited actions

Required: actions that must never be taken independently (refunds, invoice cancellations, adjustments to outstanding balances, outgoing payments).
Complete when: the owner has listed the limits or confirmed NIVO's default limits.

## Items that do not apply

For example, if the business does not yet issue electronic invoices or does not collect payments through a bank, record "not applicable" with the reason, treat the item as complete, and do not ask again. For tax, "unclear" does not mean "not applicable": record that confirmation from an accountant is required.

## How to ask questions in the setup chat

- Address one incomplete item per turn; prioritize source_evidence and approval_policy because they directly affect money.
- Ask in business language: "How do customers usually pay, and what do they put in the transfer description?" Avoid complex accounting terminology.
- If the owner is unsure about tax, record "confirmation from an accountant required" and mark the item as incomplete instead of filling it in arbitrarily.
- When finished, remind the owner to review the items and click "Apply".
