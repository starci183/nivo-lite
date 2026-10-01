"use client";

import { useState } from "react";
import { Tabs } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { landing } from "@/i18n/dict/landing";
import { BrowserFrame } from "./BrowserFrame";
import {
  BULLET,
  BULLETS,
  BULLET_MARK,
  EYEBROW,
  EYEBROW_DOT,
  H2,
  PANEL_TITLE,
  PRODUCT_BOX,
  PRODUCT_HEAD,
  PRODUCT_PANEL,
  PRODUCT_TABS,
  RAIL,
  SECTION,
  STACK,
  STACK_ITEM,
  STACK_NAME,
} from "./classNames";

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

/** Product section: five views of NIVO OS with a real screenshot and three benefits each. */
export const LandingProduct = () => {
  const t = useT(landing);
  const locale = useLocale();
  const [selected, setSelected] = useState<string>(VIEWS[0].id);
  const current = VIEWS.find((v) => v.id === selected) ?? VIEWS[0];

  const bullets = (v: View) => (
    <ul className={BULLETS}>
      {([1, 2, 3] as const).map((i) => (
        <li key={i} className={BULLET}>
          <span className={BULLET_MARK} />
          {t(`tab${v.n}b${i}` as BulletKey)}
        </li>
      ))}
    </ul>
  );
  const shot = (v: View) => (
    <BrowserFrame
      src={`/images/landing/${locale}/${v.file}.png`}
      alt={t(v.alt)}
      label={t("demoLabel")}
      width={v.w}
      height={v.h}
    />
  );

  return (
    <section id="product" className={SECTION} aria-labelledby="landing-product">
      <div className={PRODUCT_HEAD}>
        <span className={EYEBROW}>
          <span className={EYEBROW_DOT} />
          {t("productEyebrow")}
        </span>
        <h2 id="landing-product" className={`${H2} px-4`}>
          {t("productTitle")}
        </h2>
      </div>
      <div className={`${RAIL} hidden md:block`}>
        <div className={PRODUCT_BOX}>
          <div className={PRODUCT_TABS}>
            <Tabs
              label={t("tabsLabel")}
              selectedKey={current.id}
              inset="none"
              labelVisibility="always"
              items={VIEWS.map((v) => ({ id: v.id, label: t(`tab${v.n}` as TabKey) }))}
              onSelect={(key) => setSelected(String(key))}
            />
          </div>
          <div className={PRODUCT_PANEL}>
            <div className="flex max-h-[460px] justify-center overflow-hidden rounded-lg bg-[#F8FAFC] p-5">
              <div className="w-full max-w-[720px]">{shot(current)}</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <p className={PANEL_TITLE}>{t(`tab${current.n}Title` as TitleKey)}</p>
              {bullets(current)}
            </div>
          </div>
        </div>
      </div>
      <div className={`${RAIL} ${STACK}`}>
        {VIEWS.map((v) => (
          <article key={v.id} className={STACK_ITEM}>
            <p className={STACK_NAME}>{t(`tab${v.n}` as TabKey)}</p>
            {shot(v)}
            <p className={PANEL_TITLE}>{t(`tab${v.n}Title` as TitleKey)}</p>
            {bullets(v)}
          </article>
        ))}
      </div>
    </section>
  );
};
