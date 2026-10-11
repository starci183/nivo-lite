import { Button, NavLandmark, TextAction, TopBar } from "@starci/grammar/common";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { landing } from "@/i18n/dict/landing";
import { getT } from "@/i18n/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { LANDING_OFFER } from "./offer";
import { NAV_LINKS, NAV_SIGNIN } from "./classNames";

const isSignedIn = async (): Promise<boolean> => {
  try {
    return Boolean(await getAuthUser()); // token signature check only: no Auth round trip for a nav button
  } catch {
    return false;
  }
};

/** Top bar (Grammar `TopBar`, the page banner): logo, in-page anchors, language switch and sign-in / try actions. */
export const LandingNav = async () => {
  const [t, signedIn] = await Promise.all([getT(landing), isSignedIn()]);
  const links = [
    { href: "#product", label: t("navProduct") },
    { href: "#how", label: t("navHow") },
    { href: "#founding", label: t("navFounding") },
    { href: "#faq", label: t("navFaq") },
  ];
  return (
    <TopBar
      position="sticky"
      brand={
        // Unstyled home link around the approved logo raster; the anchor only carries the destination and its name.
        <a href="/" aria-label={t("homeLabel")}>
          <NivoLogo variant="full" height={36} />
        </a>
      }
      navigation={
        <div className={NAV_LINKS}>
          <NavLandmark label={t("navLabel")} layout="bar">
            {links.map((l) => (
              <TextAction key={l.href} href={l.href} appearance="route" size="sm">
                {l.label}
              </TextAction>
            ))}
          </NavLandmark>
        </div>
      }
      actions={
        <>
          <LocaleSwitch />
          <div className={NAV_SIGNIN}>
            <Button variant="ghost" size="sm" href={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? t("openDashboard") : t("signIn")}
            </Button>
          </div>
          {/* The hero's "Try NIVO OS" is the page's one primary for this command (CTA-1 case-5); the bar's copy steps down. */}
          <Button variant="secondary" size="sm" href={LANDING_OFFER.ctaHref}>
            {t("tryNow")}
          </Button>
        </>
      }
    />
  );
};
