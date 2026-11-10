import type { useTranslations } from "next-intl"
import {
    isOnMode,
    modeOfAbility,
    onModeOf,
    pickLabel,
    type AbilityMode,
    type HeldAbilityWire,
    type ProviderWire,
} from "@/hooks/providerRights"
import type { CapabilityRowView } from "./types"

/** The translator of the provider-rights words. */
export type RightsTranslate = ReturnType<typeof useTranslations<"agentRights">>

/**
 * The capability rows of one provider card: every ability of the provider, ticked when the agent holds it. A write ability also carries
 * its mode (automatic or ask); a read ability is only ticked.
 */
export const abilityRowsOf = (
    t: RightsTranslate,
    locale: string,
    provider: ProviderWire,
    held: ReadonlyArray<HeldAbilityWire>,
    setAbility: (ability: string, mode: AbilityMode) => void,
): ReadonlyArray<CapabilityRowView> =>
    provider.abilities.map((ability) => {
        const mode = modeOfAbility(held, ability.id)
        const title = pickLabel(ability.label, locale)
        return {
            id: ability.id,
            title,
            subtitle: undefined,
            isOn: mode !== "off",
            isDisabled: false,
            mode:
                ability.scope === "write"
                    ? {
                          label: t("modeLabel", { capability: title }),
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
