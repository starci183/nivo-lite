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
