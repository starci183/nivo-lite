import { Button } from "@starci/grammar/common";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { landing } from "@/i18n/dict/landing";
import { getT } from "@/i18n/server";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { LANDING_OFFER } from "./offer";
import { NAV, NAV_ACTIONS, NAV_LINK, NAV_LINKS, NAV_ROW, NAV_SIGNIN } from "./classNames";

const isSignedIn = async (): Promise<boolean> => {
  try {
    return Boolean(await getAuthUser()); // token signature check only: no Auth round trip for a nav button
  } catch {
    return false;
  }
};

/** Top bar: logo, in-page anchors, language switch and sign-in / try actions. */
export const LandingNav = async () => {
  const [t, signedIn] = await Promise.all([getT(landing), isSignedIn()]);
  const links = [
    { href: "#product", label: t("navProduct") },
    { href: "#how", label: t("navHow") },
    { href: "#founding", label: t("navFounding") },
    { href: "#faq", label: t("navFaq") },
  ];
  return (
    <header className={NAV}>
      <nav className={NAV_ROW} aria-label={t("navLabel")}>
        <a href="/" aria-label={t("homeLabel")}>
          <NivoLogo variant="full" height={36} />
        </a>
        <div className={NAV_LINKS}>
          {links.map((l) => (
            <a key={l.href} className={NAV_LINK} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className={NAV_ACTIONS}>
          <LocaleSwitch />
          <div className={NAV_SIGNIN}>
            <Button variant="secondary" size="sm" href={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? t("openDashboard") : t("signIn")}
            </Button>
          </div>
          <Button variant="primary" size="sm" href={LANDING_OFFER.ctaHref}>
            {t("tryNow")}
          </Button>
        </div>
      </nav>
    </header>
  );
};
