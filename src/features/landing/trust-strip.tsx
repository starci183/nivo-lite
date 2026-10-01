import { NivoIcon } from "@/ui";
import { getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { CHIP, RAIL, TRUST, TRUST_BOX, TRUST_CHIPS, TRUST_CORNER, TRUST_LEAD, TRUST_WHO } from "./classNames";

const CHIPS = [
  { key: "chip1", icon: "account" },
  { key: "chip2", icon: "send" },
  { key: "chip3", icon: "pending" },
  { key: "chip4", icon: "notification" },
  { key: "chip5", icon: "wallet" },
  { key: "chip6", icon: "review" },
  { key: "chip7", icon: "complete" },
  { key: "chip8", icon: "search" },
  { key: "chip9", icon: "next" },
] as const;

/** "Work that should not depend on memory": who it is for plus the situations it watches. */
export const LandingTrustStrip = async () => {
  const t = await getT(landing);
  return (
    <section className={TRUST} aria-label={t("trustFor")}>
      <p className={TRUST_LEAD}>{t("trustLead")}</p>
      <div className={RAIL}>
        <div className={TRUST_BOX}>
          <span className={`${TRUST_CORNER} -left-[3px] -top-[3px]`} />
          <span className={`${TRUST_CORNER} -right-[3px] -top-[3px]`} />
          <span className={`${TRUST_CORNER} -bottom-[3px] -left-[3px]`} />
          <span className={`${TRUST_CORNER} -bottom-[3px] -right-[3px]`} />
          <div className={TRUST_WHO}>
            <p className="text-xs text-[#64748B]">{t("trustFor")}</p>
            <p className="text-xl font-bold leading-7">{t("trustAudience")}</p>
            <p className="text-sm text-[#334155]">{t("trustSub")}</p>
          </div>
          <ul className={TRUST_CHIPS}>
            {CHIPS.map((c) => (
              <li key={c.key} className={CHIP}>
                <NivoIcon props={{ name: c.icon }} />
                {t(c.key)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
