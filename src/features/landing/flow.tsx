import { getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import {
  AI_CHIP,
  EYEBROW,
  EYEBROW_DOT,
  FLOW,
  FLOW_ART,
  FLOW_ARROW,
  FLOW_GRID,
  FLOW_META,
  FLOW_NAME,
  FLOW_STEP,
  FLOW_STEP_HUMAN,
  FLOW_TAG,
  FLOW_TEXT,
  FLOW_TITLE,
  H2,
  LEAD,
  RAIL,
  SECTION,
} from "./classNames";

const STEPS = [
  { n: 1, art: "mascot-chat", ai: true, human: false },
  { n: 2, art: "mascot-point", ai: true, human: false },
  { n: 3, art: "mascot-checklist", ai: false, human: true },
  { n: 4, art: "mascot-celebrate", ai: true, human: false },
] as const;

type NameKey = "flow1Name" | "flow2Name" | "flow3Name" | "flow4Name";
type TitleKey = "flow1Title" | "flow2Title" | "flow3Title" | "flow4Title";
type TextKey = "flow1Text" | "flow2Text" | "flow3Text" | "flow4Text";

/** "Three agents, one flow": Chatbot, Sales Agent, owner approval, Accounting Agent. */
export const LandingFlow = async () => {
  const t = await getT(landing);
  return (
    <section id="how" className={`${FLOW} scroll-mt-20`} aria-labelledby="landing-flow">
      <div className={`${SECTION} ${RAIL}`}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className={EYEBROW}>
            <span className={EYEBROW_DOT} />
            {t("flowEyebrow")}
          </span>
          <h2 id="landing-flow" className={H2}>
            {t("flowTitle")}
          </h2>
          <p className={`${LEAD} max-w-2xl`}>{t("flowLead")}</p>
        </div>
        <ol className={FLOW_GRID}>
          {STEPS.map((s) => (
            <li key={s.n} className={s.human ? FLOW_STEP_HUMAN : FLOW_STEP}>
              <div className={FLOW_META}>
                <span>{t("flowStepLabel", { n: s.n })}</span>
                {s.human ? <span className={FLOW_TAG}>{t("flowHuman")}</span> : null}
              </div>
              <img className={FLOW_ART} src={`/images/promo/${s.art}.png`} alt="" width={112} height={112} loading="lazy" />
              <p className={FLOW_NAME}>
                {t(`flow${s.n}Name` as NameKey)}
                {s.ai ? <span className={AI_CHIP}>AI</span> : null}
              </p>
              <h3 className={FLOW_TITLE}>{t(`flow${s.n}Title` as TitleKey)}</h3>
              <p className={FLOW_TEXT}>{t(`flow${s.n}Text` as TextKey)}</p>
              {s.n < 4 ? (
                <span className={FLOW_ARROW} aria-hidden="true">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
