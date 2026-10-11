import { Badge, Heading, List, ListItem, PageContainer, Region, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { LandingIconTile } from "./LandingIconTile";
import { ANCHOR, FLOW_BODY, FLOW_GRID, FLOW_ITEM, FLOW_META, FLOW_NAME, SECTION_STACK } from "./classNames";

/**
 * Each step's identity glyph (ACCENT-2). The step mascots were removed: an illustration inside a card is a second
 * signature moment, and the page keeps only one (DISCIPLINE-3 case-3; the final call to action carries it).
 */
const STEPS = [
  { n: 1, icon: "send", ai: true, human: false },
  { n: 2, icon: "agentos", ai: true, human: false },
  { n: 3, icon: "review", ai: false, human: true },
  { n: 4, icon: "wallet", ai: true, human: false },
] as const;

type NameKey = "flow1Name" | "flow2Name" | "flow3Name" | "flow4Name";
type TitleKey = "flow1Title" | "flow2Title" | "flow3Title" | "flow4Title";
type TextKey = "flow1Text" | "flow2Text" | "flow3Text" | "flow4Text";

const HEADING_ID = "landing-flow";

/** "Three agents, one flow": Chatbot, Sales Agent, owner approval, Accounting Agent, as an ordered list of cards. */
export const LandingFlow = async () => {
  const t = await getT(landing);
  return (
    <Region id="how" labelledBy={HEADING_ID} className={ANCHOR}>
      <PageContainer measure="product">
        <div className={SECTION_STACK}>
          <SectionHeader id={HEADING_ID} eyebrow={t("flowEyebrow")} title={t("flowTitle")} description={t("flowLead")} />
          <List as="ol" label={t("flowTitle")} className={FLOW_GRID}>
            {STEPS.map((s) => (
              <ListItem key={s.n} className={FLOW_ITEM}>
                {/* The owner-approval step is the one featured card (isHighlight: one card only). */}
                <SurfaceCard height="fill" isHighlight={s.human}>
                  <div className={FLOW_BODY}>
                    <div className={FLOW_META}>
                      <Text size="xs">{t("flowStepLabel", { n: s.n })}</Text>
                      {s.human ? <Badge tone="neutral">{t("flowHuman")}</Badge> : null}
                    </div>
                    <LandingIconTile name={s.icon} />
                    <div className={FLOW_NAME}>
                      <Text size="sm" weight="medium">
                        {t(`flow${s.n}Name` as NameKey)}
                      </Text>
                      {s.ai ? <Badge tone="neutral">AI</Badge> : null}
                    </div>
                    <Heading level={3}>{t(`flow${s.n}Title` as TitleKey)}</Heading>
                    <Text size="sm" tone="muted">
                      {t(`flow${s.n}Text` as TextKey)}
                    </Text>
                  </div>
                </SurfaceCard>
              </ListItem>
            ))}
          </List>
        </div>
      </PageContainer>
    </Region>
  );
};
