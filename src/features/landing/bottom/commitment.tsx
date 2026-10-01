import { getT } from "@/i18n/server";
import { landingBottom } from "@/i18n/dict/landingBottom";
import { NivoLogo } from "@/components/brand/NivoLogo";
import { Eyebrow } from "./eyebrow";
import * as c from "./classNames";

/** Principles block. Attribution is the NIVO team, never a personal quote or a photo of a person. */
export const LandingCommitment = async () => {
  const t = await getT(landingBottom);
  return (
    <section id="commitment" aria-label={t("commitAria")} className={c.SECTION}>
      <div className={c.GRID}>
        <div className={c.COMMIT_HEAD}>
          <Eyebrow>{t("commitEyebrow")}</Eyebrow>
          <h2 className={c.COMMIT_H2}>{t("commitTitle")}</h2>
        </div>
        <div className={c.COMMIT_BOX}>
          <div className={c.COMMIT_PANEL}>
            <div className={c.COMMIT_PANEL_ARC} aria-hidden="true" />
            <div className={c.COMMIT_PANEL_TOP}>
              <p className={c.EYEBROW_TEXT}>{t("commitPanelLabel")}</p>
              <p className={c.COMMIT_PANEL_LEAD}>{t("commitPanelText")}</p>
            </div>
            <div className={c.COMMIT_AUTHOR}>
              <div className={c.COMMIT_MARK}>
                <NivoLogo variant="mark" height={32} />
              </div>
              <div>
                <p className={c.COMMIT_NAME}>{t("commitAuthor")}</p>
                <p className={c.COMMIT_ROLE}>{t("commitAuthorRole")}</p>
              </div>
            </div>
          </div>
          <div className={c.COMMIT_MAIN}>
            <div>
              <blockquote className={c.COMMIT_QUOTE}>{`“${t("commitQuote")}”`}</blockquote>
              <p className={c.COMMIT_AI}>
                <span className={c.AI_CHIP}>{t("commitAiChip")}</span>
                {t("commitAiNote")}
              </p>
            </div>
            <div className={c.PRINCIPLES}>
              <div className={c.PRINCIPLE}>
                <p className={c.PRINCIPLE_TITLE}>{t("principle1Title")}</p>
                <p className={c.PRINCIPLE_TEXT}>{t("principle1Text")}</p>
              </div>
              <div className={c.PRINCIPLE}>
                <p className={c.PRINCIPLE_TITLE}>{t("principle2Title")}</p>
                <p className={c.PRINCIPLE_TEXT}>{t("principle2Text")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
