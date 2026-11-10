import { abilityRowsOf, toggleAbility, type RightsTranslate } from "@/components/composites/ProviderRightsCard"
import {
    PROVIDER_KINDS,
    accountTitleOf,
    pickLabel,
    providerLogoOf,
    type AbilityMode,
    type HeldAccount,
} from "@/hooks/providerRights"
import type { AgentConnectionsBaseProps, AttachOptionView, ProviderGroupView } from "./types"

type Props = AgentConnectionsBaseProps["props"]

/** What a card needs from the page: the reader language, where connecting leads, and the commands. */
interface CardScope {
    readonly locale: string
    readonly connectionsHref: string
    readonly setAbility: (connectionId: string, ability: string, mode: AbilityMode) => void
    readonly askDetach: (connectionId: string) => void
}

/** "<provider> · <account>" of one held or attachable account. */
export const accountNameOf = (one: HeldAccount, locale: string): string =>
    accountTitleOf(pickLabel(one.provider.label, locale), one.account.accountLabel)

/** The card of one attached account. */
const cardOf = (t: RightsTranslate, one: HeldAccount, scope: CardScope): ProviderGroupView["cards"][number]["card"] => {
    const key = one.account.connectionId
    const setAbility = (ability: string, mode: AbilityMode) => scope.setAbility(key, ability, mode)
    const kind = pickLabel(one.provider.kindLabel, scope.locale)
    return {
        props: {
            name: accountNameOf(one, scope.locale),
            logo: providerLogoOf(one.provider.provider),
            line: one.account.connected ? t("lineConnected", { kind }) : t("line", { kind }),
            badge: one.account.isDefaultReceiving ? t("defaultReceiving") : undefined,
            rows: abilityRowsOf(t, scope.locale, one.provider, one.held, setAbility),
            menu: {
                label: t("menuLabel"),
                entries: [{ id: "detach", label: t("detach"), tone: "danger", onAction: () => scope.askDetach(key) }],
            },
            connectLink: one.account.connected ? undefined : { label: t("connectLink"), href: scope.connectionsHref },
        },
        on: { toggle: (id, isOn) => toggleAbility(one.provider, one.held, id, isOn, setAbility) },
    }
}

/** The attached accounts grouped by kind, in the order messaging, payments, books (the groups only gather; one card per account). */
export const groupsOf = (
    t: RightsTranslate,
    attached: ReadonlyArray<HeldAccount>,
    scope: CardScope,
): ReadonlyArray<ProviderGroupView> =>
    PROVIDER_KINDS.flatMap((kind) => {
        const cards = attached.filter((one) => one.provider.kind === kind)
        const [first] = cards
        if (first === undefined) return []
        return [
            {
                id: kind,
                label: pickLabel(first.provider.kindLabel, scope.locale),
                cards: cards.map((one) => ({ id: one.account.connectionId, card: cardOf(t, one, scope) })),
            },
        ]
    })

/** The line under an attachable account: its kind, connected, and what the agent misses without it (a messaging account: it does not answer there). */
const consequenceOf = (t: RightsTranslate, one: HeldAccount, locale: string, agentName: string): string => {
    const line = t("lineConnected", { kind: pickLabel(one.provider.kindLabel, locale) })
    if (one.provider.kind !== "messaging") return line
    const miss =
        one.provider.provider === "zalo_oa"
            ? t("drawerMissOa", { agent: agentName })
            : t("drawerMissAccount", { agent: agentName })
    return `${line} · ${miss}`
}

/** What the drawer needs from the page: whether it is open and the agent's name (for the consequence line). */
interface DrawerInput {
    readonly isOpen: boolean
    readonly agentName: string
}

/** The attach drawer: the connected accounts the agent does not hold yet, each with its consequence line and its own "Attach". */
export const drawerOf = (
    t: RightsTranslate,
    locale: string,
    attachable: ReadonlyArray<HeldAccount>,
    input: DrawerInput,
): Props["drawer"] => ({
    isOpen: input.isOpen,
    title: t("drawerTitle"),
    closeLabel: t("close"),
    optionsLabel: t("drawerOptions"),
    options: attachable.map((one): AttachOptionView => ({
        id: one.account.connectionId,
        title: accountNameOf(one, locale),
        subtitle: consequenceOf(t, one, locale, input.agentName),
        name: pickLabel(one.provider.label, locale),
        logo: providerLogoOf(one.provider.provider),
    })),
    emptyLabel: t("drawerEmpty"),
    attachLabel: t("attach"),
})

/** The confirm of removing an account from the agent. */
export const detachOf = (t: RightsTranslate, account: string | null, agentName: string): Props["detach"] => ({
    isOpen: account !== null,
    title: t("detachTitle", { provider: account ?? "", agent: agentName }),
    description: t("detachDescription", { agent: agentName }),
    confirm: t("detach"),
    cancel: t("cancel"),
})
