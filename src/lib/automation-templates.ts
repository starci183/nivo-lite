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
import type { TemplateDef } from "./automation-shared";

/**
 * The automation catalogue, loaded from the data files in resources/automation-templates (the single source; the UI never hard-codes a template).
 * `npm run seed:automations` mirrors the same files into public.automation_templates.
 */
export const TEMPLATE_LIST: ReadonlyArray<TemplateDef> = ([
  thankPayment, nurtureLeads, dailyReport, afterHours, askReview, debtReminder, winBack, sheetOrders,
  appointmentReminder, marketplaceOrderSync, contractRenewal, deliveryNotice,
] as unknown) as ReadonlyArray<TemplateDef>;

export const TEMPLATES: Readonly<Record<string, TemplateDef>> = Object.fromEntries(TEMPLATE_LIST.map((t) => [t.key, t]));

export const templateOf = (key: string): TemplateDef | null => TEMPLATES[key] ?? null;
