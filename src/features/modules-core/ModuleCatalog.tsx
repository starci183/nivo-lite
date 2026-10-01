"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { installModule } from "@/lib/module-actions";
import { MODULE_KEYS, type Installation, type ModuleKey } from "@/lib/modules-shared";
import { MODULE_META, STATUS_TONE, statusOf } from "./meta";
import {
  CARD_ART_CLASS_NAME, CARD_ART_WRAP_CLASS_NAME, CARD_CLASS_NAME, CARD_FOOT_CLASS_NAME, CARD_HEAD_CLASS_NAME, CARD_POINTS_CLASS_NAME, CARD_POINT_CLASS_NAME,
  CARD_POINT_DOT_CLASS_NAME, CATALOG_GRID_CLASS_NAME, PAGE_CLASS_NAME,
} from "./classNames";

type ModuleCatalogProps = { readonly installations: ReadonlyArray<Installation>; readonly canInstall: boolean };

/** /m: the three modules as cards. Install creates the module, its agent and the first setup session, then opens it. */
export const ModuleCatalog = ({ installations, canInstall }: ModuleCatalogProps) => {
  const t = useT(modulesCore);
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
        <div className={CATALOG_GRID_CLASS_NAME}>
          {MODULE_KEYS.map((key) => {
            const installation = installations.find((i) => i.moduleKey === key) ?? null;
            const meta = MODULE_META[key];
            const status = statusOf(installation);
            return (
              <SurfaceCard key={key} ariaLabel={t(meta.name)}>
                <div className={CARD_CLASS_NAME}>
                  <div className={CARD_ART_WRAP_CLASS_NAME}>
                    <img className={CARD_ART_CLASS_NAME} src={meta.art} alt="" />
                  </div>
                  <div className={CARD_HEAD_CLASS_NAME}>
                    <Text weight="semibold" size="md">{t(meta.name)}</Text>
                    <Badge isDot tone={STATUS_TONE[status]}>{t(`status_${status}`)}</Badge>
                  </div>
                  <Text size="sm" tone="muted">{t(meta.what)}</Text>
                  <ul className={CARD_POINTS_CLASS_NAME}>
                    {t(meta.points).split("|").map((point) => (
                      <li key={point} className={CARD_POINT_CLASS_NAME}>
                        <span className={CARD_POINT_DOT_CLASS_NAME} aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
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
      </div>
    </PageContainer>
  );
};
