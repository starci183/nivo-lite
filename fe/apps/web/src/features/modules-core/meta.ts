import { agentHref, type Installation, type InstallationStatus, type ModuleKey } from "@/lib/modules-shared";

export type ShownStatus = InstallationStatus | "notInstalled";

export const statusOf = (installation: Installation | null | undefined): ShownStatus => installation?.status ?? "notInstalled";

export const STATUS_TONE: Record<ShownStatus, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  notInstalled: "neutral", installing: "neutral", setup: "warning", ready: "accent", live: "success", paused: "neutral",
};

export const TAB_ROUTES = ["setup", "workbench", "settings"] as const;
export type ModuleTab = (typeof TAB_ROUTES)[number];
/** A tab of one instance (/agents/<type>/<id>/<tab>); without an id, the type-level URL that redirects to the right instance. */
export const tabHref = (module: ModuleKey, tab: ModuleTab, installationId?: string | null): string => agentHref(module, installationId, tab);

/** Accent-insensitive text for matching: NFD, marks stripped, d-stroke folded, lower case ("Bán hàng" -> "ban hang"). */
export const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export const STATUS_FILTERS = ["all", "installed", "notInstalled", "early"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const isStatusFilter = (value: string | null | undefined): value is StatusFilter => (STATUS_FILTERS as ReadonlyArray<string>).includes(value ?? "");
