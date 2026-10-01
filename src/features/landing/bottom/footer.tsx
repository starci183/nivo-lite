import { getT } from "@/i18n/server";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { LANDING_OFFER } from "../offer";
import * as c from "./classNames";

type LinkKey = "linkTry" | "linkProduct" | "linkFounding" | "linkPrinciples" | "linkFaq" | "linkSignIn" | "linkStart" | "linkTerms";
type Column = { readonly title: "colProduct" | "colCompany" | "colSupport"; readonly links: ReadonlyArray<readonly [LinkKey, string]> };

/** Only real destinations: in-page anchors and the sign-in page. No placeholder pages. */
const COLUMNS: ReadonlyArray<Column> = [
  { title: "colProduct", links: [["linkTry", LANDING_OFFER.ctaHref], ["linkProduct", "#product"], ["linkFounding", "#founding"]] },
  { title: "colCompany", links: [["linkPrinciples", "#commitment"], ["linkFaq", "#faq"], ["linkSignIn", LANDING_OFFER.ctaHref]] },
  { title: "colSupport", links: [["linkFaq", "#faq"], ["linkStart", LANDING_OFFER.ctaHref], ["linkTerms", "#faq"]] },
];

/** Landing footer: logo, three columns, watermark, legal line with unconfirmed details flagged. */
export const LandingFooter = async () => {
  const t = await getT(landingBottom);
  return (
    <footer aria-label={t("footerAria")} className={c.FOOT_WRAP}>
      <div className={c.FOOT_CARD}>
        <div className={c.FOOT_NOTCH} aria-hidden="true" />
        <div className={c.FOOT_COLS}>
          <div className={c.FOOT_BRAND}>
            <div className="flex flex-col gap-4">
              <a href="#top" aria-label={t("footerHome")}>
                <NivoLogo variant="full" height={40} />
              </a>
              <p className={c.FOOT_ABOUT}>{t("footerAbout")}</p>
            </div>
            <p className={c.FOOT_TAGLINE}>{t("footerTagline")}</p>
          </div>
          <div className={c.FOOT_NAV_WRAP}>
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={t(col.title)} className={c.FOOT_NAV}>
                <p className={c.FOOT_NAV_TITLE}>{t(col.title)}</p>
                {col.links.map(([key, href]) => (
                  <a key={`${col.title}-${key}`} className={c.FOOT_LINK} href={href}>
                    {t(key)}
                  </a>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div className={c.FOOT_WATERMARK} aria-hidden="true">
          <div className={c.FOOT_WATERMARK_IMG}>
            <NivoLogo variant="full" height={190} />
          </div>
        </div>
        <div className={c.FOOT_LEGAL}>
          <div className={c.FOOT_LEGAL_ROW}>
            <p className="m-0">{t("footerCopyright")}</p>
            <p className={c.FOOT_MUTED}>{t("footerLegal")}</p>
          </div>
          <p className={c.FOOT_MUTED}>{t("footerLegalNote")}</p>
          <p className={c.FOOT_MUTED}>{t("footerPolicies")}</p>
        </div>
      </div>
    </footer>
  );
};
