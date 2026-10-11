"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge, Heading, IconTile, Image, PageContainer, PrimaryRailLayout, Text, TextAction } from "@starci/grammar/common";
import { nivoIconSource, RouteTabs } from "@/ui";
import { useLocale, useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { moduleDef, pick } from "@/lib/module-registry";
import type { Installation, ModuleKey } from "@/lib/modules-shared";
import { STATUS_TONE, TAB_ROUTES, statusOf, tabHref, type ModuleTab } from "./meta";
import {
  HEADER_CLASS_NAME, HEADER_COPY_CLASS_NAME, HEADER_META_CLASS_NAME, HEADER_TITLE_CLASS_NAME,
  MAIN_CLASS_NAME, RAIL_CLASS_NAME, RAIL_COPY_CLASS_NAME, RAIL_HEAD_CLASS_NAME,
} from "./classNames";

type ModuleChromeProps = {
  readonly current: Installation;
  readonly installations: ReadonlyArray<Installation>;
  /** Setup is for owners and managers only. */
  readonly canSetup: boolean;
  readonly children: ReactNode;
};

/** The frame of every module page: the three modules on the left, the module's header and its Setup | Workbench | Settings tabs. */
export const ModuleChrome = ({ current, installations, canSetup, children }: ModuleChromeProps) => {
  const t = useT(modulesCore);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const key: ModuleKey = current.moduleKey;
  const def = moduleDef(key);
  const tabs = TAB_ROUTES.filter((tab) => canSetup || tab !== "setup");
  const selected: ModuleTab = pathname.endsWith("/workbench") ? "workbench" : pathname.endsWith("/settings") ? "settings" : "setup";
  const tabLabel = { setup: t("tabSetup"), workbench: t("tabWorkbench"), settings: t("tabSettings") } as const;
  const status = statusOf(current);

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
            <TextAction href="/m" size="sm" appearance="muted">{t("allModules")}</TextAction>
          </div>
          {installations.map((installation) => {
            const k = installation.moduleKey;
            const isCurrent = k === key;
            return (
              <TextAction
                key={k}
                href={`/m/${k}`}
                appearance="route"
                isCurrent={isCurrent}
                startContent={<IconTile source={nivoIconSource("apps", "leading")} artwork={<Image src={moduleDef(k).mascot} alt="" aspect="square" fit="contain" plate="none" />} />}
              >
                <span className={RAIL_COPY_CLASS_NAME}>
                  <Text as="span" weight="semibold" size="sm">{pick(moduleDef(k).name, locale)}</Text>
                  <Badge isDot tone={STATUS_TONE[statusOf(installation)]}>{t(`status_${statusOf(installation)}`)}</Badge>
                </span>
              </TextAction>
            );
          })}
        </nav>
        }
        primary={
        <div className={MAIN_CLASS_NAME}>
          <header className={HEADER_CLASS_NAME}>
            <IconTile size="md" source={nivoIconSource("apps", "leading")} artwork={<Image src={def.mascot} alt="" aspect="square" fit="contain" plate="none" />} />
            <div className={HEADER_COPY_CLASS_NAME}>
              <div className={HEADER_TITLE_CLASS_NAME}>
                <Heading level={1}>{pick(def.name, locale)}</Heading>
                {def.status === "early" ? <Badge tone="accent">{t("earlyBadge")}</Badge> : null}
                <Badge isDot tone={STATUS_TONE[status]}>{t(`status_${status}`)}</Badge>
              </div>
              <div className={HEADER_META_CLASS_NAME}>
                <Text size="sm" tone="muted">{current.activeVersion === null ? t("noVersion") : t("versionInUse", { version: current.activeVersion })}</Text>
                <Text size="sm" tone="muted">{current.liveEnabled ? t("liveOn") : t("liveOff")}</Text>
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
