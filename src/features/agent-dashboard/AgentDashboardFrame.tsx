"use client";

import { useState, type ReactNode } from "react";
import { Alert, Badge, Breadcrumbs, Button, DescriptionList, SectionHeader, SurfaceCard, SurfaceListCard, Tabs, type DescriptionListStatItem } from "@starci/grammar/common";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/i18n/client";
import { agentDashboard } from "@/i18n/dict/agentDashboard";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import { moduleDef, pick } from "@/lib/module-registry";
import type { ModuleKey } from "@/lib/modules-shared";
import { FRAME_CLASS_NAME, HEAD_CLASS_NAME, PANEL_CLASS_NAME, SIDE_COLUMN_CLASS_NAME, SIDE_GRID_CLASS_NAME } from "./classNames";
import { ConnectionsRegion, DoneRegion, KnowledgeRegion, WaitingRegion } from "./regions";

/**
 * AGENT DASHBOARD FRAME - the one page anatomy of every agent's workbench (/m/<module>/workbench). It composes @starci/grammar only.
 * Regions, top to bottom:
 *
 *   1. Breadcrumbs, then a SectionHeader: the agent's name, its mode badge (assist / autopilot) and the page command (`command`).
 *   2. The ribbon (`figures`): a plain SurfaceCard with a DescriptionList stat-strip of 4 figures chosen per agent.
 *   3. "Chờ bạn"            data.waiting      the decisions of this module that wait for a person, each linking to the decision.
 *   4. "Đã tự làm 7 ngày"   data.done         count and the last items.
 *   5. "Kết nối"            data.connections  the connections bound to the agent and their status.
 *   6. "Tri thức"           data.knowledge    what the agent can read (public / internal counts) and, if present, its open knowledge gaps.
 *   7. `tabs`               the module's own areas, in Tabs. One tab is rendered without a strip.
 *
 * HOW A MODULE ADOPTS IT (three files, no new component):
 *   - server entry (workbench/index.tsx): `const dashboard = await loadAgentDashboard("<module>", { decisionHref? })` from lib/agent-dashboard.ts
 *     next to the module's own loader, then render the module's client view with both.
 *   - client view: `<AgentDashboardFrame module data={dashboard} figures={[4 DescriptionListStatItem]} tabs={[{ id, label, content }]} initialTab={tab} />`.
 *     The module keeps all its own panels as the `content` of its tabs.
 *   - loading.tsx entry (features/module-workbench/loading.tsx): a client component returning the same frame with `isLoading`, the module's real
 *     figure terms and tab labels and no `data`; register it in LOADINGS there. Failure of the whole route is app/(console)/m/[module]/workbench/error.tsx
 *     (RouteError); a failed region fails in place (`Region.ok === false`), a failed ribbon through `figuresFailed`.
 *
 * Props:
 *   module        the module key (names the trail, the decision log link).
 *   data          AgentDashboardData from loadAgentDashboard; omit with `isLoading`.
 *   isLoading     STATE-8: the same tree with real labels; only agent name, figures and lists are skeleton (three rows per collection).
 *   command       the page command in the header (one primary per view). Omit for the default "Talk to the agent" (/modules/<agentId>/chat); pass null for none.
 *   figures       exactly 4 stat-strip items (id, term, description, optional meta/unit). Terms stay real while loading, descriptions become skeleton.
 *   figuresFailed the ribbon's own data could not be read: it fails in place with an Alert and a retry.
 *   tabs          { id, label, content }[]. In `isLoading` a tab without `content` shows a three-row skeleton collection.
 *   initialTab    the tab id from ?tab= (the server reads searchParams and passes it); unknown ids open the first tab.
 *   tab           controlled selection, for a module whose panels switch tabs themselves (Sales: Attention -> Decisions); with it, onTabChange is required to move.
 *   gaps          a module's own gaps card (chatbot: KnowledgeGapsCard) in place of the Tri thức region's built-in gaps block.
 *   onTabChange   called with the new tab id (the frame also writes ?tab= into the address bar with history.replaceState).
 *
 * Shared URL contract of a workbench: `?tab=<tab id>` selects a tab and `?focus=<record id>` names the record the "Chờ bạn" row leads to
 * (see workbenchHref); the module reads `focus` on the server and opens/highlights that record.
 *
 * GRAMMAR GAP: Tabs publishes no `variant` yet (the Frontend standard asks Tabs variant="primary" for a page's main areas). The strip below is
 * the only Tabs there is; when the grammar ships `variant`, set it here once and every module follows.
 */

export type AgentDashboardTab = {
  readonly id: string;
  readonly label: string;
  /** The tab's content; omit only while loading. */
  readonly content?: ReactNode;
};

export type AgentDashboardFrameProps = {
  readonly module: ModuleKey;
  readonly data?: AgentDashboardData;
  readonly isLoading?: boolean;
  readonly command?: ReactNode | null;
  readonly figures: ReadonlyArray<DescriptionListStatItem>;
  readonly figuresFailed?: boolean;
  readonly tabs: ReadonlyArray<AgentDashboardTab>;
  readonly initialTab?: string | null;
  readonly tab?: string;
  readonly onTabChange?: (id: string) => void;
  /** Replaces the "Tri thức" region's own read-only gaps block (a module with richer gap actions passes its card; null shows no gaps block). */
  readonly gaps?: ReactNode;
};

const tabPanelId = (id: string): string => `agent-dashboard-panel-${id}`;

const resolveTab = (tabs: ReadonlyArray<AgentDashboardTab>, id: string | null | undefined): string => (tabs.find((t) => t.id === id) ?? tabs[0])?.id ?? "";

export const AgentDashboardFrame = ({
  module, data, isLoading = false, command, figures, figuresFailed = false, tabs, initialTab = null, tab, onTabChange, gaps,
}: AgentDashboardFrameProps) => {
  const t = useT(agentDashboard);
  const tc = useT(modulesCore);
  const ts = useT(shell);
  const locale = useLocale();
  const router = useRouter();
  const [own, setOwn] = useState<string>(() => resolveTab(tabs, initialTab));
  const selected = resolveTab(tabs, tab ?? own);

  const select = (id: string) => {
    if (tab === undefined) setOwn(resolveTab(tabs, id));
    onTabChange?.(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url);
    } catch {
      // the address bar is a convenience only
    }
  };

  const agent = data?.agent ?? null;
  const moduleName = pick(moduleDef(module).name, locale);
  const heading = isLoading ? moduleName : agent?.name || moduleName;
  const chat = agent ? <Button variant="primary" href={`/modules/${agent.id}/chat`}>{t("commandChat")}</Button> : null;
  const header = command === undefined ? chat : command;
  const active = tabs.find((x) => x.id === selected);

  return (
    <div className={FRAME_CLASS_NAME}>
      <div className={HEAD_CLASS_NAME}>
        <Breadcrumbs
          label={ts("crumbLabel")}
          items={[
            { id: "home", label: ts("crumbHome"), href: "/dashboard" },
            { id: "modules", label: tc("catalogTitle"), href: "/m" },
            { id: "module", label: moduleName, href: `/m/${module}` },
            { id: "workbench", label: tc("tabWorkbench") },
          ]}
        />
        <SectionHeader
          level={2}
          title={heading}
          isSkeleton={isLoading}
          meta={
            agent ? (
              <Badge tone={agent.mode === "autopilot" ? "success" : "accent"} isDot>{agent.mode === "autopilot" ? t("modeAutopilot") : t("modeAssist")}</Badge>
            ) : undefined
          }
          action={header ?? undefined}
        />
      </div>

      {figuresFailed ? (
        <Alert tone="negative" title={t("regionFailed")} description={t("regionFailedText")} action={{ label: t("retry"), onAction: () => router.refresh() }} />
      ) : (
        <SurfaceCard ariaLabel={t("ribbonAria")}>
          <DescriptionList layout="stat-strip" isDivided isLoading={isLoading} items={figures} />
        </SurfaceCard>
      )}

      <WaitingRegion region={data?.waiting} isLoading={isLoading} />

      <div className={SIDE_GRID_CLASS_NAME}>
        <DoneRegion region={data?.done} isLoading={isLoading} module={module} />
        <ConnectionsRegion region={data?.connections} isLoading={isLoading} />
        <div className={SIDE_COLUMN_CLASS_NAME}>
          <KnowledgeRegion region={data?.knowledge} isLoading={isLoading} gaps={gaps} />
        </div>
      </div>

      {tabs.length > 1 ? (
        <Tabs label={t("tabsLabel")} selectedKey={selected} items={tabs.map(({ id, label }) => ({ id, label }))} inset="none" labelVisibility="always" panelId={tabPanelId} onSelect={select} />
      ) : null}
      <div className={PANEL_CLASS_NAME} role={tabs.length > 1 ? "tabpanel" : undefined} id={tabs.length > 1 ? tabPanelId(selected) : undefined}>
        {active?.content ?? (isLoading ? <SurfaceListCard ariaLabel={active?.label ?? t("tabsLabel")} isLoading /> : null)}
      </div>
    </div>
  );
};
