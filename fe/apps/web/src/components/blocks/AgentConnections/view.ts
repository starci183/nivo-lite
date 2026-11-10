import { abilityRowsOf, toggleAbility, type RightsTranslate } from "@/components/composites/ProviderRightsCard"
import {
    PROVIDER_KINDS,
    pickLabel,
    providerLogoOf,
    providerNameOf,
    type AbilityMode,
    type HeldProvider,
    type ProviderWire,
} from "@/hooks/providerRights"
import type { AgentConnectionsBaseProps, ProviderGroupView } from "./types"

type Props = AgentConnectionsBaseProps["props"]

/** Whether the attach drawer is open and which provider is picked. */
interface DrawerState {
    readonly isOpen: boolean
    readonly pickedId: string | null
}

/** What a card needs from the page: where connecting leads, and the commands. */
interface CardScope {
    readonly locale: string
    readonly connectionsHref: string
    readonly setAbility: (provider: string, ability: string, mode: AbilityMode) => void
    readonly askDetach: (provider: string) => void
}

/** The card of one held provider. */
const cardOf = (t: RightsTranslate, one: HeldProvider, scope: CardScope): ProviderGroupView["cards"][number]["card"] => {
    const key = one.provider.provider
    const setAbility = (ability: string, mode: AbilityMode) => scope.setAbility(key, ability, mode)
    const kind = pickLabel(one.provider.kindLabel, scope.locale)
    return {
        props: {
            name: providerNameOf(key),
            logo: providerLogoOf(key),
            line: one.provider.connected ? t("lineConnected", { kind }) : t("line", { kind }),
            rows: abilityRowsOf(t, scope.locale, one.provider, one.held, setAbility),
            menu: {
                label: t("menuLabel"),
                entries: [{ id: "detach", label: t("detach"), tone: "danger", onAction: () => scope.askDetach(key) }],
            },
            connectLink: one.provider.connected ? undefined : { label: t("connectLink"), href: scope.connectionsHref },
        },
        on: { toggle: (id, isOn) => toggleAbility(one.provider, one.held, id, isOn, setAbility) },
    }
}

/** The held providers grouped by kind, in the order messaging, payments, books. */
export const groupsOf = (t: RightsTranslate, attached: ReadonlyArray<HeldProvider>, scope: CardScope): ReadonlyArray<ProviderGroupView> =>
    PROVIDER_KINDS.flatMap((kind) => {
        const cards = attached.filter((one) => one.provider.kind === kind)
        const [first] = cards
        if (first === undefined) return []
        return [{ id: kind, label: pickLabel(first.provider.kindLabel, scope.locale), cards: cards.map((one) => ({ id: one.provider.provider, card: cardOf(t, one, scope) })) }]
    })

/** The attach drawer: the connected providers the agent does not hold yet. */
export const drawerOf = (
    t: RightsTranslate,
    locale: string,
    attachable: ReadonlyArray<ProviderWire>,
    state: DrawerState,
): Props["drawer"] => ({
    isOpen: state.isOpen,
    title: t("drawerTitle"),
    closeLabel: t("close"),
    optionsLabel: t("drawerOptions"),
    options: attachable.map((option) => ({
        id: option.provider,
        title: providerNameOf(option.provider),
        subtitle: pickLabel(option.kindLabel, locale),
    })),
    pickedId: state.pickedId,
    emptyLabel: t("drawerEmpty"),
    cancelLabel: t("cancel"),
    submitLabel: t("attach"),
})

/** The confirm of removing a provider. */
export const detachOf = (t: RightsTranslate, provider: string | null, agentName: string): Props["detach"] => ({
    isOpen: provider !== null,
    title: t("detachTitle", { provider: provider === null ? "" : providerNameOf(provider), agent: agentName }),
    description: t("detachDescription", { agent: agentName }),
    confirm: t("detach"),
    cancel: t("cancel"),
})
