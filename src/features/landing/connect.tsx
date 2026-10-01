import { Button } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { LANDING_OFFER } from "./offer";
import {
  CONNECT,
  CONNECT_ART,
  CONNECT_EYEBROW,
  CONNECT_GRID,
  CONNECT_ITEM,
  CONNECT_ITEM_ON,
  CONNECT_LEAD,
  CONNECT_LIST,
  CONNECT_NAME,
  CONNECT_NOTE,
  CONNECT_OK,
  CONNECT_SOON,
  CONNECT_TEXT,
  EYEBROW_DOT,
  H2,
  RAIL,
  SECTION,
} from "./classNames";

const CHANNELS = [
  { name: "chWebsite", text: "chWebsiteText", live: true },
  { name: "chZalo", text: "chZaloText", live: false },
  { name: "chEmail", text: "chEmailText", live: false },
  { name: "chForm", text: "chFormText", live: false },
] as const;

/** Connect section on ink: the channel that works today and the ones on the roadmap. */
export const LandingConnect = async () => {
  const t = await getT(landing);
  return (
    <section className={CONNECT} aria-labelledby="landing-connect">
      <div className={`${SECTION} ${RAIL}`}>
        <div className={CONNECT_GRID}>
          <div className="flex flex-col items-start gap-5">
            <span className={CONNECT_EYEBROW}>
              <span className={EYEBROW_DOT} />
              {t("connectEyebrow")}
            </span>
            <h2 id="landing-connect" className={H2}>
              {t("connectTitle")}
            </h2>
            <p className={CONNECT_LEAD}>{t("connectLead")}</p>
            <img className={CONNECT_ART} src="/images/promo/mascot-offer.png" alt="" width={160} height={160} loading="lazy" />
            <Button variant="primary" size="lg" href={LANDING_OFFER.ctaHref}>
              {t("connectCta")}
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            <ul className={CONNECT_LIST}>
              {CHANNELS.map((c) => (
                <li key={c.name} className={c.live ? CONNECT_ITEM_ON : CONNECT_ITEM}>
                  <div>
                    <p className={CONNECT_NAME}>{t(c.name)}</p>
                    <p className={CONNECT_TEXT}>{t(c.text)}</p>
                  </div>
                  <span className={c.live ? CONNECT_OK : CONNECT_SOON}>
                    {c.live ? t("connectAvailable") : t("connectRoadmap")}
                  </span>
                </li>
              ))}
            </ul>
            <p className={CONNECT_NOTE}>{t("connectNote")}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
