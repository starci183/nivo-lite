import type { Installation, InstallationStatus, ModuleKey } from "@/lib/modules-shared";

/** Per-module presentation: the mascot and the dictionary keys of its name, summary and bullet points. */
export const MODULE_META = {
  chatbot: { art: "/images/promo/mascot-chat.png", name: "chatbotName", what: "chatbotWhat", points: "chatbotPoints" },
  sales: { art: "/images/promo/mascot-point.png", name: "salesName", what: "salesWhat", points: "salesPoints" },
  accounting: { art: "/images/promo/mascot-checklist.png", name: "accountingName", what: "accountingWhat", points: "accountingPoints" },
} as const satisfies Record<ModuleKey, { art: string; name: string; what: string; points: string }>;

export type ShownStatus = InstallationStatus | "notInstalled";

export const statusOf = (installation: Installation | null | undefined): ShownStatus => installation?.status ?? "notInstalled";

export const STATUS_TONE: Record<ShownStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  notInstalled: "neutral", installing: "neutral", setup: "warning", ready: "accent", live: "success", paused: "neutral",
};

export const TAB_ROUTES = ["setup", "workbench", "settings"] as const;
export type ModuleTab = (typeof TAB_ROUTES)[number];
export const tabHref = (module: ModuleKey, tab: ModuleTab): string => (tab === "setup" ? `/m/${module}` : `/m/${module}/${tab}`);
