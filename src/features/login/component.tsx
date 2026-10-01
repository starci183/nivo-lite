"use client";

import { nivoIconSource, NivoIcon } from "@/ui";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { useT } from "@/i18n/client";
import { login } from "@/i18n/dict/login";
import { FoundingOffer } from "@/components/promo/FoundingOffer";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { Alert, Button, Heading, IconTile, SurfaceCard, Text } from "@starci/grammar/common";
import {
  LOGIN_ACTIONS_CLASS_NAME,
  LOGIN_BRAND_PANE_CLASS_NAME,
  LOGIN_CANVAS_CLASS_NAME,
  LOGIN_CARD_CLASS_NAME,
  LOGIN_FORM_PANE_CLASS_NAME,
  LOGIN_HEADLINE_CLASS_NAME,
  LOGIN_LOCALE_CLASS_NAME,
  LOGIN_MASCOT_CLASS_NAME,
  LOGIN_POINTS_ROW_CLASS_NAME,
  LOGIN_POINT_CLASS_NAME,
  LOGIN_POINTS_CLASS_NAME,
  LOGIN_STACK_CLASS_NAME,
} from "./classNames";

/** Resolved facts the pure login card draws. */
export type LoginBaseData = {
  readonly showDemo: boolean;
  readonly error?: string;
  readonly isGooglePending: boolean;
  readonly isDemoPending: boolean;
};

/** Commands the login card reports back. */
export type LoginBaseActions = {
  readonly google: () => void;
  readonly demo: () => void;
};

/** Props for {@link LoginBase}. */
export type LoginBaseProps = { readonly props: LoginBaseData; readonly on: LoginBaseActions };

const POINTS = [
  { icon: "explore", text: "pointCapture" },
  { icon: "account", text: "pointOwner" },
  { icon: "review", text: "pointApprove" },
] as const;

/** Draw the split sign-in screen: brand pitch on the left, sign-in card on the right (stacked on mobile). */
export const LoginBase = ({ props, on }: LoginBaseProps) => {
  const t = useT(login);
  return (
  <main className={LOGIN_CANVAS_CLASS_NAME}>
    <div className={LOGIN_LOCALE_CLASS_NAME}>
      <LocaleSwitch />
    </div>
    <section className={LOGIN_BRAND_PANE_CLASS_NAME} aria-label={t("aboutLabel")}>
      <NivoLogo variant="full" height={56} />
      <div className={LOGIN_HEADLINE_CLASS_NAME}>
        <Heading level={1} scale="display">
          {t("headline")}
        </Heading>
      </div>
      <Text tone="muted">{t("tagline")}</Text>
      <div className={LOGIN_POINTS_ROW_CLASS_NAME}>
        <ul className={LOGIN_POINTS_CLASS_NAME}>
          {POINTS.map((point) => (
            <li key={point.text} className={LOGIN_POINT_CLASS_NAME}>
              <IconTile source={nivoIconSource(point.icon, "leading")} tone="neutral" />
              <Text weight="medium">{t(point.text)}</Text>
            </li>
          ))}
        </ul>
        <img className={LOGIN_MASCOT_CLASS_NAME} src="/images/promo/mascot-point.png" alt="" />
      </div>
      <FoundingOffer variant="pill" />
    </section>
    <section className={LOGIN_FORM_PANE_CLASS_NAME}>
      <div className={LOGIN_CARD_CLASS_NAME}>
        <SurfaceCard ariaLabel={t("signInLabel")}>
          <div className={LOGIN_STACK_CLASS_NAME}>
            <div>
              <Heading level={2}>{t("signInTitle")}</Heading>
              <Text tone="muted">{t("signInText")}</Text>
            </div>
            {props.error ? <Alert title={t("failedTitle")} description={props.error} tone="negative" /> : null}
            <div className={LOGIN_ACTIONS_CLASS_NAME}>
              {props.showDemo ? (
                <Button variant="primary" width="fill" isPending={props.isDemoPending} onPress={on.demo}>
                  {t("demo")}
                </Button>
              ) : null}
              <Button
                variant={props.showDemo ? "secondary" : "primary"}
                width="fill"
                isPending={props.isGooglePending}
                startContent={<NivoIcon props={{ name: "google" }} />}
                onPress={on.google}
              >
                {t("google")}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </section>
  </main>
  );
};
