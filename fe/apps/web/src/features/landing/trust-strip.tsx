import { List, ListItem, PageContainer, Region, SurfaceCard, Text } from "@starci/grammar/common";
import { Icon as NivoIcon } from "@/components/leaves/Icon"
import { getT } from "@/i18n/server";
import { landing } from "@/i18n/dict/landing";
import { SECTION_STACK, TRUST_LIST, TRUST_ROW, TRUST_WHO } from "./classNames";

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

/** "Work that should not depend on memory": who it is for plus the situations it watches, on one top-level card. */
export const LandingTrustStrip = async () => {
  const t = await getT(landing);
  return (
    <Region label={t("trustFor")}>
      <PageContainer measure="product">
        <div className={SECTION_STACK}>
          <Text tone="muted">{t("trustLead")}</Text>
          <SurfaceCard>
            <div className={TRUST_ROW}>
              <div className={TRUST_WHO}>
                <Text size="xs">{t("trustFor")}</Text>
                <Text size="md" weight="semibold">
                  {t("trustAudience")}
                </Text>
                <Text size="sm" tone="muted">
                  {t("trustSub")}
                </Text>
              </div>
              <List label={t("trustFor")} className={TRUST_LIST}>
                {CHIPS.map((c) => (
                  <ListItem key={c.key}>
                    <Text size="sm" startContent={<NivoIcon props={{ name: c.icon, usage: "leading" }} />}>
                      {t(c.key)}
                    </Text>
                  </ListItem>
                ))}
              </List>
            </div>
          </SurfaceCard>
        </div>
      </PageContainer>
    </Region>
  );
};
