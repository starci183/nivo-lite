"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Breadcrumbs, Button, Heading, Image, List, ListItem, MediaFrame, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";
import { installModule } from "@/lib/module-actions";
import { modulesByCategory, pick, pickList } from "@/lib/module-registry";
import type { Installation, ModuleKey } from "@/lib/modules-shared";
import { STATUS_TONE, statusOf } from "./meta";
import {
  BADGES_CLASS_NAME, CARD_CLASS_NAME, CARD_FOOT_CLASS_NAME, CARD_HEAD_CLASS_NAME, CARD_POINTS_CLASS_NAME, CATALOG_GRID_CLASS_NAME, CATEGORY_CLASS_NAME, PAGE_CLASS_NAME, HEAD_CLASS_NAME,
} from "./classNames";

type ModuleCatalogProps = {
  readonly installations: ReadonlyArray<Installation>;
  readonly canInstall: boolean;
  /** STATE-8: the same page while the installations load - the registry's cards stay real, each status and action is a skeleton. */
  readonly isLoading?: boolean;
};

/** /agents: every module of the registry as a card, grouped by category. Install creates the module, its agent and the first setup session, then opens it. */
export const ModuleCatalog = ({ installations, canInstall, isLoading = false }: ModuleCatalogProps) => {
  const t = useT(modulesCore);
  const ts = useT(shell);
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<ModuleKey | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [, startTransition] = useTransition();

  const onInstall = (key: ModuleKey) => {
    setError(undefined);
    setBusy(key);
    startTransition(async () => {
      const result = await installModule(key);
      if (!result.ok) { setError(result.error); setBusy(null); return; }
      router.push(`/agents/${key}`);
    });
  };

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <div className={HEAD_CLASS_NAME}>
          <Breadcrumbs label={ts("crumbLabel")} items={[{ id: "home", label: ts("crumbHome"), href: "/dashboard" }, { id: "modules", label: t("catalogTitle") }]} />
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("catalogTitle")} description={t("catalogDescription")} />
        </div>
        {error !== undefined ? <Alert title={t("installFailed")} description={error} tone="negative" /> : null}
        {modulesByCategory().map(({ category, modules }) => (
          <section key={category.key} className={CATEGORY_CLASS_NAME} aria-label={pick(category.label, locale)}>
            <Heading level={2}>{pick(category.label, locale)}</Heading>
            <div className={CATALOG_GRID_CLASS_NAME}>
              {modules.map((def) => {
                const key = def.key;
                const installation = installations.find((i) => i.moduleKey === key) ?? null;
                const status = statusOf(installation);
                return (
                  <SurfaceCard key={key} ariaLabel={pick(def.name, locale)}>
                    <div className={CARD_CLASS_NAME}>
                      <MediaFrame aspect="landscape" fit="contain">
                        <Image src={def.mascot} alt="" aspect="landscape" fit="contain" plate="none" />
                      </MediaFrame>
                      <div className={CARD_HEAD_CLASS_NAME}>
                        <Heading level={3}>{pick(def.name, locale)}</Heading>
                        <span className={BADGES_CLASS_NAME}>
                          {def.status === "early" ? <Badge tone="accent">{t("earlyBadge")}</Badge> : null}
                          <Badge isDot isSkeleton={isLoading} tone={STATUS_TONE[status]}>{t(`status_${status}`)}</Badge>
                        </span>
                      </div>
                      <Text size="sm" tone="muted">{pick(def.description, locale)}</Text>
                      <List label={pick(def.name, locale)} className={CARD_POINTS_CLASS_NAME}>
                        {pickList(def.points, locale).map((point) => (
                          <ListItem key={point}><Text size="sm" tone="muted">{point}</Text></ListItem>
                        ))}
                      </List>
                      {def.status === "early" ? <Text size="xs" tone="muted">{t("earlyHint")}</Text> : null}
                      <div className={CARD_FOOT_CLASS_NAME}>
                        {isLoading ? (
                          <Button variant="secondary" isSkeleton>{t("openModule")}</Button>
                        ) : installation !== null ? (
                          <Button variant="secondary" href={`/agents/${key}`}>{t("openModule")}</Button>
                        ) : canInstall ? (
                          <Button variant="primary" isPending={busy === key} isDisabled={busy !== null} onPress={() => onInstall(key)}>{t("install")}</Button>
                        ) : null}
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  );
};
