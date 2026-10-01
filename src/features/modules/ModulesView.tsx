"use client";

import { Badge, Button, Heading, Icon, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { nivoIconSource } from "@/ui";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import Image from "next/image";
import { MODULES, moduleCopy } from "@/lib/modules";
import { useLocale, useT } from "@/i18n/client";
import { modules } from "@/i18n/dict/modules";
import { offerEndLabel } from "@/features/promo-ads/format";
import { RIBBON, RIBBON_WRAP } from "@/features/promo-ads/classNames";
import { FOUNDING_OFFER, isOfferLive } from "@/lib/promo";
import { AgentCard } from "@/features/modules/AgentCard";
import type { AgentStats } from "@/features/modules/queries";
import {
  CAPABILITY_ROW_CLASS_NAME, CARD_STACK_CLASS_NAME, CATALOG_GRID_CLASS_NAME, CATALOG_HEAD_CLASS_NAME, FOUNDING_LINE_CLASS_NAME, LIST_CLASS_NAME, MASCOT_CLASS_NAME, PAGE_STACK_CLASS_NAME, SECTION_STACK_CLASS_NAME,
} from "@/features/modules/classNames";

type ModulesViewProps = { readonly stats: ReadonlyArray<AgentStats>; readonly updatedAt?: string };

/** Client view of the page (grammar surfaces render on the client). */
export const ModulesView = ({ stats }: ModulesViewProps) => {
  const t = useT(modules);
  const locale = useLocale();
  return (
  <PageContainer measure="product">
    <div className={PAGE_STACK_CLASS_NAME}>
      <SectionHeader
        level={1}
        eyebrow={t("eyebrow")}
        title={t("pageTitle")}
        description={t("pageDescription")}
        action={<Button variant="primary" href="#catalog">{t("addAgent")}</Button>}
      />
      <div className={SECTION_STACK_CLASS_NAME}>
        <SectionHeader level={2} title={t("yourAgents")} description={t("agentsCount", { count: stats.length })} />
        {stats.map((item) => <AgentCard key={item.agent.id} stats={item} />)}
      </div>
      <div className={SECTION_STACK_CLASS_NAME}>
        <SectionHeader id="catalog" level={2} title={t("catalogTitle")} description={t("catalogDescription")} />
        <div className={CATALOG_GRID_CLASS_NAME}>
          {MODULES.map((spec) => {
            const installed = stats.find((item) => item.agent.module === spec.key);
            const isFounding = spec.key === "chatbot" && installed === undefined && isOfferLive();
            const badge = installed !== undefined ? (spec.includedWithWorkspace ? t("badgeIncluded") : t("badgeInWorkspace")) : t("badgeNotInWorkspace");
            const copy = moduleCopy(spec, locale);
            return (
              <div key={spec.key} className={RIBBON_WRAP}>
              {isFounding ? <span className={RIBBON}>{t("foundingRibbon", { name: FOUNDING_OFFER.name, percent: FOUNDING_OFFER.percentOff })}</span> : null}
              <SurfaceCard ariaLabel={spec.name} height="fill">
                <div className={CARD_STACK_CLASS_NAME}>
                  <div className={CATALOG_HEAD_CLASS_NAME}>
                    <AgentAvatar module={spec.key} size="md" label={spec.name} />
                    {isFounding ? null : <Badge tone="neutral" isDot={installed !== undefined}>{badge}</Badge>}
                  </div>
                  <Heading level={3}>{spec.name}</Heading>
                  <Text as="p" size="sm" tone="muted">{copy.summary}</Text>
                  <div className={LIST_CLASS_NAME}>
                    {copy.capabilities.map((capability) => (
                      <div key={capability} className={CAPABILITY_ROW_CLASS_NAME}>
                        <Icon source={nivoIconSource("complete", "leading")} usage="leading" />
                        <Text size="sm">{capability}</Text>
                      </div>
                    ))}
                  </div>
                  {installed !== undefined
                    ? <Button variant="outline" href={`/modules/${installed.agent.id}`}>{t("open", { name: spec.name })}</Button>
                    : <Button variant="secondary" href={`/modules/new?module=${spec.key}`}>{t("buy", { name: spec.name })}</Button>}
                  {isFounding ? (
                    <div className={FOUNDING_LINE_CLASS_NAME}>
                      <Image src="/images/promo/mascot-offer.png" alt="" width={586} height={640} className={MASCOT_CLASS_NAME} />
                      <Text size="sm" weight="medium">{t("foundingLine", { cap: FOUNDING_OFFER.cap, date: offerEndLabel(locale) })}</Text>
                    </div>
                  ) : null}
                  {installed === undefined ? <Text size="xs" tone="muted">{t("billedWithPlan")}</Text> : null}
                </div>
              </SurfaceCard>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </PageContainer>
  );
};
