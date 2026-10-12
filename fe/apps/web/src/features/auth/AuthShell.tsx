"use client";

import type { ReactNode } from "react";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { useT } from "@/i18n/client";
import { login } from "@/i18n/dict/login";
import { FoundingOffer } from "@/components/promo/FoundingOffer";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { Heading, Image, IncludedMark, List, ListItem, Region, SurfaceCard, SurfaceCopyGroup, Text, TextAction } from "@starci/grammar/common";
import {
  AUTH_ART_BAND_CLASS_NAME,
  AUTH_BRAND_CARD_CLASS_NAME,
  AUTH_BRAND_PANE_CLASS_NAME,
  AUTH_BRAND_STACK_CLASS_NAME,
  AUTH_DETAILS_CLASS_NAME,
  AUTH_PITCH_CLASS_NAME,
  AUTH_TAGLINE_CLASS_NAME,
  AUTH_CANVAS_CLASS_NAME,
  AUTH_CARD_CLASS_NAME,
  AUTH_FORM_PANE_CLASS_NAME,
  AUTH_LOCALE_CLASS_NAME,
  AUTH_POINTS_CLASS_NAME,
  AUTH_POINT_CLASS_NAME,
  AUTH_STACK_CLASS_NAME,
  AUTH_LEGAL_CLASS_NAME,
} from "./classNames";

const POINTS = [
  { text: "pointCapture" },
  { text: "pointOwner" },
  { text: "pointApprove" },
] as const;

/** Props for {@link AuthShell}. */
export type AuthShellProps = { readonly label: string; readonly title: string; readonly text?: string; readonly children: ReactNode };

/** The split auth screen: brand pitch on the left, the auth card on the right (stacked on mobile). */
export const AuthShell = ({ label, title, text, children }: AuthShellProps) => {
  const t = useT(login);
  return (
    <main className={AUTH_CANVAS_CLASS_NAME}>
      <div className={AUTH_LOCALE_CLASS_NAME}>
        <LocaleSwitch />
      </div>
      <div className={AUTH_BRAND_PANE_CLASS_NAME}>
        <div className={AUTH_BRAND_CARD_CLASS_NAME}>
          <Region label={t("aboutLabel")}>
          <SurfaceCard ariaLabel={t("aboutLabel")} composition="joined">
            <div className={AUTH_ART_BAND_CLASS_NAME} aria-hidden="true">
              <Image src="/images/entry/login-mascot.png" alt="" aspect="wide" fit="contain" plate="none" loading="eager" />
            </div>
            <div className={AUTH_BRAND_STACK_CLASS_NAME}>
              <div className={AUTH_PITCH_CLASS_NAME}>
                <NivoLogo variant="full" height={40} />
                <Heading level={1}>{t("headline")}</Heading>
                <div className={AUTH_TAGLINE_CLASS_NAME}>
                  <Text tone="muted">{t("tagline")}</Text>
                </div>
              </div>
              <div className={AUTH_DETAILS_CLASS_NAME}>
                <List className={AUTH_POINTS_CLASS_NAME}>
                  {POINTS.map((point) => (
                    <ListItem key={point.text} className={AUTH_POINT_CLASS_NAME}>
                      <IncludedMark />
                      <Text>{t(point.text)}</Text>
                    </ListItem>
                  ))}
                </List>
                <FoundingOffer variant="pill" />
              </div>
            </div>
          </SurfaceCard>
          </Region>
        </div>
      </div>
      <section className={AUTH_FORM_PANE_CLASS_NAME}>
        <div className={AUTH_CARD_CLASS_NAME}>
          <SurfaceCard ariaLabel={label}>
            <div className={AUTH_STACK_CLASS_NAME}>
              <SurfaceCopyGroup>
                <Heading level={2}>{title}</Heading>
                {text ? <Text tone="muted">{text}</Text> : null}
              </SurfaceCopyGroup>
              {children}
            </div>
          </SurfaceCard>
          <nav aria-label={t("legalLabel")} className={AUTH_LEGAL_CLASS_NAME}>
            <TextAction href="/privacy" size="sm">{t("privacyLink")}</TextAction>
            <TextAction href="/terms" size="sm">{t("termsLink")}</TextAction>
          </nav>
        </div>
      </section>
    </main>
  );
};
