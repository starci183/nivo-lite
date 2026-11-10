import type { useTranslations } from "next-intl"
import { abilityKeyOf, isOnMode, modeOfAbility, onModeOf } from "@/hooks/providerRights"
import type { AbilityMode, HeldAbilityWire, ProviderWire } from "@/hooks/providerRights"
import type { CapabilityRowView } from "./index"

/** The translator of the provider-rights words. */
export type RightsTranslate = ReturnType<typeof useTranslations<"agentRights">>

/**
 * The capability rows of one provider card: every ability of the provider, ticked when the agent holds it. A write ability also carries
 * its mode (Tự động | Hỏi); a read ability is only ticked. A hint shows under an ability that is off and has one.
 */
export const abilityRowsOf = (
    t: RightsTranslate,
    provider: ProviderWire,
    held: ReadonlyArray<HeldAbilityWire>,
    setAbility: (ability: string, mode: AbilityMode) => void,
): ReadonlyArray<CapabilityRowView> =>
    provider.abilities.map((ability) => {
        const key = abilityKeyOf(ability.id)
        const mode = modeOfAbility(held, ability.id)
        return {
            id: ability.id,
            title: t.has(`ability_${key}`) ? t(`ability_${key}`) : ability.label.en,
            subtitle: mode === "off" && t.has(`abilityHint_${key}`) ? t(`abilityHint_${key}`) : undefined,
            isOn: mode !== "off",
            isDisabled: false,
            mode:
                ability.scope === "write"
                    ? {
                          label: t("modeLabel", { capability: t.has(`ability_${key}`) ? t(`ability_${key}`) : ability.label.en }),
                          value: mode === "ask" ? "ask" : "auto",
                          options: [
                              { id: "auto", label: t("modeAuto") },
                              { id: "ask", label: t("modeAsk") },
                          ],
                          onChange: (value: string) => {
                              if (isOnMode(value)) setAbility(ability.id, onModeOf(ability, value))
                          },
                      }
                    : undefined,
        }
    })

/** What turning one row on or off sets the ability to. */
export const toggleAbility = (
    provider: ProviderWire,
    held: ReadonlyArray<HeldAbilityWire>,
    abilityId: string,
    isOn: boolean,
    setAbility: (ability: string, mode: AbilityMode) => void,
): void => {
    const ability = provider.abilities.find((one) => one.id === abilityId)
    if (ability === undefined) return
    setAbility(abilityId, isOn ? onModeOf(ability, modeOfAbility(held, abilityId)) : "off")
}
