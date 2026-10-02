import afterHours from "../../resources/automation-templates/after_hours.json";
import appointmentReminder from "../../resources/automation-templates/appointment_reminder.json";
import askReview from "../../resources/automation-templates/ask_review.json";
import contractRenewal from "../../resources/automation-templates/contract_renewal.json";
import dailyReport from "../../resources/automation-templates/daily_report.json";
import debtReminder from "../../resources/automation-templates/debt_reminder.json";
import deliveryNotice from "../../resources/automation-templates/delivery_notice.json";
import marketplaceOrderSync from "../../resources/automation-templates/marketplace_order_sync.json";
import nurtureLeads from "../../resources/automation-templates/nurture_leads.json";
import sheetOrders from "../../resources/automation-templates/sheet_orders.json";
import thankPayment from "../../resources/automation-templates/thank_payment.json";
import winBack from "../../resources/automation-templates/win_back.json";
import emailDailyReport from "../../resources/n8n-templates/email-daily-report.meta.json";
import emailDebtReminder from "../../resources/n8n-templates/email-debt-reminder.meta.json";
import emailMonthLedger from "../../resources/n8n-templates/email-month-ledger.meta.json";
import emailPaymentReceipt from "../../resources/n8n-templates/email-payment-receipt.meta.json";
import type { TemplateDef } from "./automation-shared";

/**
 * The automation catalogue, loaded from the data files in resources/automation-templates (executors run by NIVO) and resources/n8n-templates/<key>.meta.json
 * (executor "n8n": shared n8n workflows that send email). One definition format for both; the UI never hard-codes a template.
 * `npm run seed:automations` mirrors the same files into public.automation_templates.
 *
 * An n8n template lists its wording as a setting ("body", a textarea) for its own legacy screen; here the wording is the pipeline's approved `body`
 * (the same editor as every template), so that setting is dropped from the settings the gallery shows.
 */
const fromN8n = (raw: unknown): TemplateDef => {
  const t = raw as TemplateDef & { readonly settings: ReadonlyArray<{ readonly key: string }> };
  return { ...t, settings: t.settings.filter((s) => s.key !== "body") } as TemplateDef;
};

export const TEMPLATE_LIST: ReadonlyArray<TemplateDef> = [
  ...(([
    thankPayment, nurtureLeads, dailyReport, afterHours, askReview, debtReminder, winBack, sheetOrders,
    appointmentReminder, marketplaceOrderSync, contractRenewal, deliveryNotice,
  ] as unknown) as ReadonlyArray<TemplateDef>),
  ...[emailDailyReport, emailPaymentReceipt, emailDebtReminder, emailMonthLedger].map(fromN8n),
];

export const TEMPLATES: Readonly<Record<string, TemplateDef>> = Object.fromEntries(TEMPLATE_LIST.map((t) => [t.key, t]));

export const templateOf = (key: string): TemplateDef | null => TEMPLATES[key] ?? null;
