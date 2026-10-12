import type { ModuleKey } from "./types";
import type { Locale } from "@/i18n/core";
import { listModules, moduleDef, pick, pickList } from "./module-registry";

/** Interface copy of one module in one language. */
export type ModuleCopy = {
  summary: string;
  capabilities: string[];
  defaultRole: string;
  defaultInstructions: string;
};

/**
 * The NIVO module catalog, read from the module registry (resources/modules/<key>/module.json). Sales and Accounting come with every
 * workspace; every other module is added from the catalogue. `available` = can be bought/added from the catalog.
 * `defaultRole` / `defaultInstructions` mirror the English copy and are the server-side fallbacks; the screens
 * read the reader's language through `moduleCopy`.
 */
export type ModuleSpec = {
  key: ModuleKey;
  name: string;
  copy: Record<Locale, ModuleCopy>;
  available: boolean;
  includedWithWorkspace: boolean;
  defaultRole: string;
  defaultInstructions: string;
};

export const MODULES: ModuleSpec[] = listModules().map((m) => {
  const copyOf = (locale: Locale): ModuleCopy => ({
    summary: pick(m.agent.summary, locale), capabilities: [...pickList(m.agent.capabilities, locale)],
    defaultRole: pick(m.agent.role, locale), defaultInstructions: pick(m.agent.instructions, locale),
  });
  const copy = { en: copyOf("en"), vi: copyOf("vi") };
  return {
    key: m.key, name: m.agent.name.replace(/ Agent$/, ""), copy, available: m.available, includedWithWorkspace: m.includedWithWorkspace,
    defaultRole: copy.en.defaultRole, defaultInstructions: copy.en.defaultInstructions,
  };
});

export const moduleSpec = (key: ModuleKey) => MODULES.find((m) => m.key === key) ?? MODULES[0];

/** The agent a module installs with: display name and handle. */
export const moduleAgentDefaults = (key: ModuleKey): { name: string; handle: string } => ({ name: moduleDef(key).agent.name, handle: moduleDef(key).agent.handle });

/** The module's interface copy in the reader's language. */
export const moduleCopy = (spec: ModuleSpec, locale: Locale): ModuleCopy => spec.copy[locale];
