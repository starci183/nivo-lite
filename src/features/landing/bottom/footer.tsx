import { Footer, Text } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { LANDING_OFFER } from "../offer";
import { FOOT_BRAND, FOOT_LEGAL } from "./classNames";

type LinkKey = "linkTry" | "linkProduct" | "linkFounding" | "linkPrinciples" | "linkFaq" | "linkSignIn" | "linkStart" | "linkTerms";
type Column = { readonly title: "colProduct" | "colCompany" | "colSupport"; readonly links: ReadonlyArray<readonly [LinkKey, string]> };

/** Only real destinations: in-page anchors and the sign-in page. No placeholder pages. */
const COLUMNS: ReadonlyArray<Column> = [
  { title: "colProduct", links: [["linkTry", LANDING_OFFER.ctaHref], ["linkProduct", "#product"], ["linkFounding", "#founding"]] },
  { title: "colCompany", links: [["linkPrinciples", "#commitment"], ["linkFaq", "#faq"], ["linkSignIn", LANDING_OFFER.ctaHref]] },
  { title: "colSupport", links: [["linkFaq", "#faq"], ["linkStart", LANDING_OFFER.ctaHref], ["linkTerms", "#faq"]] },
];

/**
 * Landing footer, Grammar's `Footer` (the contentinfo landmark): brand, three link directories, legal row with the
 * unconfirmed details flagged. The decorative notch, nested bordered boxes and the oversized logo watermark carried
 * no information and were removed (DISCIPLINE-1).
 */
export const LandingFooter = async () => {
  const t = await getT(landingBottom);
  return (
    <Footer
      label={t("footerAria")}
      brand={
        <div className={FOOT_BRAND}>
          {/* Unstyled home link around the approved logo raster. */}
          <a href="#top" aria-label={t("footerHome")}>
            <NivoLogo variant="full" height={40} />
          </a>
          <Text size="sm" tone="muted">
            {t("footerAbout")}
          </Text>
          <Text size="sm" weight="medium">
            {t("footerTagline")}
          </Text>
        </div>
      }
      groups={COLUMNS.map((col) => ({
        id: col.title,
        label: t(col.title),
        links: col.links.map(([key, href]) => ({ id: `${col.title}-${key}`, label: t(key), href })),
      }))}
      legal={
        <div className={FOOT_LEGAL}>
          <Text size="sm">{t("footerCopyright")}</Text>
          <Text size="sm" tone="muted">
            {t("footerLegal")}
          </Text>
          <Text size="xs">{t("footerLegalNote")}</Text>
          <Text size="xs">{t("footerPolicies")}</Text>
        </div>
      }
    />
  );
};
