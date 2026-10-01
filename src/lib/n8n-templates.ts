import dailyReport from "../../resources/n8n-templates/email-daily-report.meta.json";
import debtReminder from "../../resources/n8n-templates/email-debt-reminder.meta.json";
import monthLedger from "../../resources/n8n-templates/email-month-ledger.meta.json";
import paymentReceipt from "../../resources/n8n-templates/email-payment-receipt.meta.json";

/**
 * The n8n pipeline catalogue (client-safe). One shared n8n workflow per template (resources/n8n-templates/<key>.json) serves every business;
 * `<key>.meta.json` is the NIVO-side definition and uses the same shape as resources/automation-templates (executor "n8n").
 * Setting kinds used here: time, number, text, textarea, email (the automations catalogue also has toggle).
 */
export type L = { readonly vi: string; readonly en: string };
export type SettingDef = {
  readonly key: string;
  readonly kind: "time" | "number" | "text" | "textarea" | "email";
  readonly label: L;
  readonly min?: number;
  readonly max?: number;
  readonly suffix?: L;
  readonly required?: boolean;
};
export type N8nTemplate = {
  readonly key: string;
  readonly version: number;
  readonly pack: string;
  readonly executor: "n8n";
  readonly moduleKey: string | null;
  readonly icon: string;
  readonly name: L;
  readonly description: L;
  readonly trigger: { readonly kind: "schedule" | "event"; readonly event: string; readonly line: L };
  readonly requires: { readonly modules: ReadonlyArray<string>; readonly connections: ReadonlyArray<string> };
  readonly settings: ReadonlyArray<SettingDef>;
  readonly variables: ReadonlyArray<string>;
  readonly defaultBody: L;
  readonly authority: { readonly action: string | null };
  readonly defaults: Readonly<Record<string, string | number>>;
  readonly n8n: { readonly webhook: string; readonly audience: "owner" | "customer" };
};

export const N8N_TEMPLATES: ReadonlyArray<N8nTemplate> = [dailyReport, paymentReceipt, debtReminder, monthLedger] as unknown as ReadonlyArray<N8nTemplate>;
export const n8nTemplateOf = (key: string): N8nTemplate | null => N8N_TEMPLATES.find((t) => t.key === key) ?? null;

/** Settings a new pipeline starts with: the defaults plus the approved default wording (vi). */
export const defaultConfig = (t: N8nTemplate): Record<string, string | number> => ({ ...t.defaults, body: t.defaultBody.vi });

/** The purpose recorded on every email a template sends. */
export const PURPOSE_OF: Readonly<Record<string, string>> = {
  "email-daily-report": "daily_report", "email-payment-receipt": "receipt", "email-debt-reminder": "debt_reminder", "email-month-ledger": "month_ledger",
};
