"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Heading, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { installModule } from "@/lib/module-actions";
import { modulesByCategory, pick, pickList } from "@/lib/module-registry";
import type { Installation, ModuleKey } from "@/lib/modules-shared";
import { STATUS_TONE, statusOf } from "./meta";
import {
  CARD_ART_CLASS_NAME, CARD_ART_WRAP_CLASS_NAME, CARD_CLASS_NAME, CARD_FOOT_CLASS_NAME, CARD_HEAD_CLASS_NAME, CARD_POINTS_CLASS_NAME, CARD_POINT_CLASS_NAME,
  CARD_POINT_DOT_CLASS_NAME, CATALOG_GRID_CLASS_NAME, CATEGORY_CLASS_NAME, PAGE_CLASS_NAME,
} from "./classNames";

type ModuleCatalogProps = { readonly installations: ReadonlyArray<Installation>; readonly canInstall: boolean };

/** /m: every module of the registry as a card, grouped by category. Install creates the module, its agent and the first setup session, then opens it. */
export const ModuleCatalog = ({ installations, canInstall }: ModuleCatalogProps) => {
  const t = useT(modulesCore);
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
      router.push(`/m/${key}`);
    });
  };

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("catalogTitle")} description={t("catalogDescription")} />
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
                      <div className={CARD_ART_WRAP_CLASS_NAME}>
                        <img className={CARD_ART_CLASS_NAME} src={def.mascot} alt="" />
                      </div>
                      <div className={CARD_HEAD_CLASS_NAME}>
                        <Text weight="semibold" size="md">{pick(def.name, locale)}</Text>
                        <span className="flex flex-wrap items-center justify-end gap-1">
                          {def.status === "early" ? <Badge tone="accent">{t("earlyBadge")}</Badge> : null}
                          <Badge isDot tone={STATUS_TONE[status]}>{t(`status_${status}`)}</Badge>
                        </span>
                      </div>
                      <Text size="sm" tone="muted">{pick(def.description, locale)}</Text>
                      <ul className={CARD_POINTS_CLASS_NAME}>
                        {pickList(def.points, locale).map((point) => (
                          <li key={point} className={CARD_POINT_CLASS_NAME}>
                            <span className={CARD_POINT_DOT_CLASS_NAME} aria-hidden="true" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                      {def.status === "early" ? <Text size="xs" tone="muted">{t("earlyHint")}</Text> : null}
                      <div className={CARD_FOOT_CLASS_NAME}>
                        {installation !== null ? (
                          <Button variant="secondary" href={`/m/${key}`}>{t("openModule")}</Button>
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
