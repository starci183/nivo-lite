"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge, Breadcrumbs, Heading, IconTile, Image, PageContainer, PrimaryRailLayout, Text, TextAction } from "@starci/grammar/common";
import { nivoIconSource, RouteTabs } from "@/ui";
import { useLocale, useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";
import { moduleDef, pick } from "@/lib/module-registry";
import { MODULE_KEYS, type Installation, type ModuleKey } from "@/lib/modules-shared";
import { STATUS_TONE, TAB_ROUTES, statusOf, tabHref, type ModuleTab } from "./meta";
import {
  HEADER_CLASS_NAME, HEADER_COPY_CLASS_NAME, HEADER_META_CLASS_NAME, HEADER_TITLE_CLASS_NAME,
  HEAD_CLASS_NAME, MAIN_CLASS_NAME, RAIL_CLASS_NAME, RAIL_COPY_CLASS_NAME, RAIL_HEAD_CLASS_NAME,
} from "./classNames";

type ModuleChromeProps = {
  /** The module's installation; null while it loads (isLoading), when only `moduleKey` is known. */
  readonly current: Installation | null;
  /** The module the frame is for: known from the route before the installation resolves. */
  readonly moduleKey: ModuleKey;
  readonly installations: ReadonlyArray<Installation>;
  /** Setup is for owners and managers only. */
  readonly canSetup: boolean;
  /** STATE-8: the same frame while its data loads - names, mascots, tab labels stay; statuses, version and live state are skeletons. */
  readonly isLoading?: boolean;
  readonly children?: ReactNode;
};

/** The frame of every module page: the three modules on the left, the module's header and its Setup | Workbench | Settings tabs. */
export const ModuleChrome = ({ current, moduleKey, installations, canSetup, isLoading = false, children }: ModuleChromeProps) => {
  const t = useT(modulesCore);
  const ts = useT(shell);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const key: ModuleKey = moduleKey;
  const def = moduleDef(key);
  const tabs = TAB_ROUTES.filter((tab) => canSetup || tab !== "setup");
  const selected: ModuleTab = pathname.endsWith("/workbench") ? "workbench" : pathname.endsWith("/settings") ? "settings" : "setup";
  const tabLabel = { setup: t("tabSetup"), workbench: t("tabWorkbench"), settings: t("tabSettings") } as const;
  const status = statusOf(current);
  // While loading the siblings are not known: the registry lists them all, each with an unresolved status.
  const siblings: ReadonlyArray<{ readonly key: ModuleKey; readonly installation: Installation | null }> = isLoading
    ? MODULE_KEYS.map((k) => ({ key: k, installation: null }))
    : installations.map((i) => ({ key: i.moduleKey, installation: i }));

  return (
    <PageContainer measure="product">
      <PrimaryRailLayout
        railPosition="leading"
        railWidth="compact"
        align="start"
        collapsedOrder="rail-first"
        rail={
        <nav aria-label={t("navLabel")} className={RAIL_CLASS_NAME}>
          <div className={RAIL_HEAD_CLASS_NAME}>
            <TextAction href="/agents" size="sm" appearance="muted">{t("allModules")}</TextAction>
          </div>
          {siblings.map(({ key: k, installation }) => {
            const isCurrent = k === key;
            return (
              <TextAction
                key={k}
                href={`/agents/${k}`}
                appearance="route"
                isCurrent={isCurrent}
                startContent={<IconTile source={nivoIconSource("apps", "leading")} artwork={<Image src={moduleDef(k).mascot} alt="" aspect="square" fit="contain" plate="none" />} />}
              >
                <span className={RAIL_COPY_CLASS_NAME}>
                  <Text as="span" weight="semibold" size="sm">{pick(moduleDef(k).name, locale)}</Text>
                  <Badge isDot isSkeleton={isLoading} tone={STATUS_TONE[statusOf(installation)]}>{t(`status_${statusOf(installation)}`)}</Badge>
                </span>
              </TextAction>
            );
          })}
        </nav>
        }
        primary={
        <div className={MAIN_CLASS_NAME}>
          <div className={HEAD_CLASS_NAME}>
            <Breadcrumbs label={ts("crumbLabel")} items={[{ id: "home", label: ts("crumbHome"), href: "/dashboard" }, { id: "modules", label: t("catalogTitle"), href: "/agents" }, { id: "module", label: pick(def.name, locale) }]} />
          </div>
          <header className={HEADER_CLASS_NAME}>
            <IconTile size="md" source={nivoIconSource("apps", "leading")} artwork={<Image src={def.mascot} alt="" aspect="square" fit="contain" plate="none" />} />
            <div className={HEADER_COPY_CLASS_NAME}>
              <div className={HEADER_TITLE_CLASS_NAME}>
                <Heading level={1}>{pick(def.name, locale)}</Heading>
                {def.status === "early" ? <Badge tone="accent">{t("earlyBadge")}</Badge> : null}
                <Badge isDot isSkeleton={isLoading} tone={STATUS_TONE[status]}>{t(`status_${status}`)}</Badge>
              </div>
              <div className={HEADER_META_CLASS_NAME}>
                <Text size="sm" tone="muted" isSkeleton={isLoading}>{current === null || current.activeVersion === null ? t("noVersion") : t("versionInUse", { version: current.activeVersion })}</Text>
                <Text size="sm" tone="muted" isSkeleton={isLoading}>{current?.liveEnabled ? t("liveOn") : t("liveOff")}</Text>
              </div>
            </div>
          </header>
          <RouteTabs
            props={{ label: t("tabsLabel"), selectedKey: selected, tabs: tabs.map((tab) => ({ id: tab, label: tabLabel[tab] })) }}
            on={{ select: (id) => router.push(tabHref(key, id as ModuleTab)) }}
          />
          {children}
        </div>
        }
      />
    </PageContainer>
  );
};
