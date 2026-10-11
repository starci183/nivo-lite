"use client";

import { useState } from "react";
import { Heading, List, ListItem, PageContainer, Region, SectionHeader, SurfaceCard, Tabs, Text } from "@starci/grammar/common";
import { NivoIcon } from "@/ui";
import { useLocale, useT } from "@/i18n/client";
import { landing } from "@/i18n/dict/landing";
import { BrowserFrame } from "./BrowserFrame";
import { ANCHOR, BULLETS, PRODUCT_COPY, PRODUCT_DESKTOP, PRODUCT_STACK, SECTION_STACK } from "./classNames";

const VIEWS = [
  { id: "office", n: 1, file: "office", w: 1184, h: 1020, alt: "shotOffice" },
  { id: "context", n: 2, file: "lead-context", w: 775, h: 620, alt: "shotContext" },
  { id: "owner", n: 3, file: "owner", w: 775, h: 325, alt: "shotOwner" },
  { id: "approval", n: 4, file: "approval", w: 775, h: 565, alt: "shotApproval" },
  { id: "outcome", n: 5, file: "outcome", w: 775, h: 754, alt: "shotOutcome" },
] as const;

type View = (typeof VIEWS)[number];
type TabKey = "tab1" | "tab2" | "tab3" | "tab4" | "tab5";
type TitleKey = "tab1Title" | "tab2Title" | "tab3Title" | "tab4Title" | "tab5Title";
type BulletKey = `tab${1 | 2 | 3 | 4 | 5}b${1 | 2 | 3}`;

const HEADING_ID = "landing-product";

/** Product section: five views of NIVO OS with a real screenshot and three benefits each. */
export const LandingProduct = () => {
  const t = useT(landing);
  const locale = useLocale();
  const [selected, setSelected] = useState<string>(VIEWS[0].id);
  const current = VIEWS.find((v) => v.id === selected) ?? VIEWS[0];

  const bullets = (v: View) => (
    <List className={BULLETS}>
      {([1, 2, 3] as const).map((i) => (
        <ListItem key={i}>
          <Text size="sm" startContent={<NivoIcon props={{ name: "complete", usage: "leading" }} />}>
            {t(`tab${v.n}b${i}` as BulletKey)}
          </Text>
        </ListItem>
      ))}
    </List>
  );
  const shot = (v: View) => (
    <BrowserFrame src={`/images/landing/${locale}/${v.file}.png`} alt={t(v.alt)} label={t("demoLabel")} width={v.w} height={v.h} />
  );

  return (
    <Region id="product" labelledBy={HEADING_ID} className={ANCHOR}>
      <PageContainer measure="product">
        <div className={SECTION_STACK}>
          <SectionHeader id={HEADING_ID} eyebrow={t("productEyebrow")} title={t("productTitle")} />
          <div className={PRODUCT_DESKTOP}>
            <SurfaceCard>
              <Tabs
                label={t("tabsLabel")}
                selectedKey={current.id}
                inset="none"
                labelVisibility="always"
                items={VIEWS.map((v) => ({ id: v.id, label: t(`tab${v.n}` as TabKey) }))}
                onSelect={(key) => setSelected(String(key))}
              />
              {shot(current)}
              <div className={PRODUCT_COPY}>
                <Heading level={3}>{t(`tab${current.n}Title` as TitleKey)}</Heading>
                {bullets(current)}
              </div>
            </SurfaceCard>
          </div>
          <div className={PRODUCT_STACK}>
            {VIEWS.map((v) => (
              <article key={v.id} className={SECTION_STACK}>
                <Text size="sm" tone="muted" weight="medium">
                  {t(`tab${v.n}` as TabKey)}
                </Text>
                {shot(v)}
                <Heading level={3}>{t(`tab${v.n}Title` as TitleKey)}</Heading>
                {bullets(v)}
              </article>
            ))}
          </div>
        </div>
      </PageContainer>
    </Region>
  );
};
