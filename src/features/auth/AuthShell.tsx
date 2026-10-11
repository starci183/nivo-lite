"use client";

import type { ReactNode } from "react";
import { nivoIconSource } from "@/ui";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { useT } from "@/i18n/client";
import { login } from "@/i18n/dict/login";
import { FoundingOffer } from "@/components/promo/FoundingOffer";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { Heading, IconTile, Image, List, ListItem, MediaFrame, Region, SurfaceCard, SurfaceCopyGroup, Text } from "@starci/grammar/common";
import {
  AUTH_BRAND_PANE_CLASS_NAME,
  AUTH_CANVAS_CLASS_NAME,
  AUTH_CARD_CLASS_NAME,
  AUTH_FORM_PANE_CLASS_NAME,
  AUTH_HEADLINE_CLASS_NAME,
  AUTH_LOCALE_CLASS_NAME,
  AUTH_MASCOT_CLASS_NAME,
  AUTH_POINTS_CLASS_NAME,
  AUTH_POINTS_ROW_CLASS_NAME,
  AUTH_POINT_CLASS_NAME,
  AUTH_STACK_CLASS_NAME,
} from "./classNames";

const POINTS = [
  { icon: "explore", text: "pointCapture" },
  { icon: "account", text: "pointOwner" },
  { icon: "review", text: "pointApprove" },
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
      <Region label={t("aboutLabel")} className={AUTH_BRAND_PANE_CLASS_NAME}>
        <NivoLogo variant="full" height={56} />
        <div className={AUTH_HEADLINE_CLASS_NAME}>
          <Heading level={1} scale="display">
            {t("headline")}
          </Heading>
        </div>
        <Text tone="muted">{t("tagline")}</Text>
        <div className={AUTH_POINTS_ROW_CLASS_NAME}>
          <List className={AUTH_POINTS_CLASS_NAME}>
            {POINTS.map((point) => (
              <ListItem key={point.text} className={AUTH_POINT_CLASS_NAME}>
                <IconTile source={nivoIconSource(point.icon, "leading")} tone="neutral" />
                <Text weight="medium">{t(point.text)}</Text>
              </ListItem>
            ))}
          </List>
          <div className={AUTH_MASCOT_CLASS_NAME}>
            <MediaFrame treatment="plain" aspect="square" fit="contain">
              <Image src="/images/promo/mascot-point.png" alt="" aspect="square" fit="contain" plate="none" />
            </MediaFrame>
          </div>
        </div>
        <FoundingOffer variant="pill" />
      </Region>
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
        </div>
      </section>
    </main>
  );
};
