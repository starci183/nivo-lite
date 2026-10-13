import { MODULE_REGISTRY } from "@/modules/catalog"
import { AUTOMATION_ROUTES } from "@/modules/routes"
import {
    automationStatusOf,
    automationText,
    isSwitchLocked,
    moduleOfAutomationFilter,
    startsAutomationConnection,
} from "./status"
import type { AutomationFilterKey, AutomationStatus } from "./status"
import type {
    AccountsView,
    AutomationCardView,
    AutomationTone,
    AutomationsLanguage,
    AutomationsTranslator,
    CardView,
} from "@/modules/types"

const TONE: Record<AutomationStatus, AutomationTone> = {
    running: "success",
    off: "neutral",
    soon: "neutral",
    needsGoogle: "warning",
    needsWebhook: "warning",
    needsEmail: "warning",
    googleLost: "danger",
    googleUnavailable: "neutral",
    missing: "warning",
}

const LABEL: Record<AutomationStatus, string> = {
    running: "statusRunning",
    off: "statusOff",
    soon: "statusSoon",
    needsGoogle: "statusNeedsGoogle",
    needsWebhook: "statusNeedsWebhook",
    needsEmail: "statusNeedsEmail",
    googleLost: "statusNeedsGoogle",
    googleUnavailable: "statusNeedsGoogle",
    missing: "statusMissing",
}

const FILTER_LABEL: Readonly<Record<string, string>> = {
    all: "filterAll",
    chatbot: "filterChatbot",
    sales: "filterSales",
    accounting: "filterAccounting",
    workspace: "filterWorkspace",
    on: "filterOn",
}

/** The Google accounts of the workspace a card can write with. */
interface GoogleAccountView {
    readonly id: string
    readonly name: string
    readonly status: "connected" | "error"
}

/** What the cards need beyond the card: the words, the language and the state of the screen. */
export interface CardContext {
    readonly t: AutomationsTranslator
    readonly locale: AutomationsLanguage
    readonly selected: string | null
    readonly busyKey: string | null
    readonly accounts: ReadonlyArray<GoogleAccountView>
}

const noteOf = (card: AutomationCardView, status: AutomationStatus, ctx: CardContext): CardView["note"] => {
    const first = card.missing[0]
    if (status === "missing" && first !== undefined) {
        const items = card.missing.map((item) => automationText(item.label, ctx.locale)).join(", ")
        return {
            text: ctx.t("missingLine", { items }),
            link: { href: first.href, label: automationText(first.label, ctx.locale) },
        }
    }
    if (status === "googleUnavailable") return { text: ctx.t("googleUnavailable") }
    if (status === "googleLost") return { text: ctx.t("googleLost") }
    if (status === "needsWebhook") {
        return { text: "", link: { href: AUTOMATION_ROUTES.developers, label: ctx.t("connectWebhook") } }
    }
    return undefined
}

const accountsOf = (card: AutomationCardView, ctx: CardContext): AccountsView | undefined => {
    if (!card.def.requires.connections.includes("google")) return undefined
    const current = card.config.googleConnectionId
    return {
        label: ctx.t("googleAccount"),
        description: ctx.t("googleAccountHint"),
        options: ctx.accounts.map((account) => ({
            id: account.id,
            label: account.name === "" ? ctx.t("googleAccountUnnamed") : account.name,
            isDisabled: account.status === "error",
        })),
        value: typeof current === "string" ? current : null,
        isPending: ctx.busyKey === card.key,
    }
}

/** What one card shows: its words, its badge, the one thing to fix and whether its switch can be pressed. */
export const automationCardOf = (card: AutomationCardView, ctx: CardContext): CardView => {
    const status = automationStatusOf(card)
    const note = noteOf(card, status, ctx)
    const accounts = accountsOf(card, ctx)
    const locked = ctx.busyKey === card.key || isSwitchLocked(status)
    return {
        dataKey: card.key,
        name: automationText(card.def.name, ctx.locale),
        description: automationText(card.def.description, ctx.locale),
        triggerLine: automationText(card.def.trigger.line, ctx.locale),
        statusLabel: ctx.t(LABEL[status]),
        statusTone: TONE[status],
        icon: card.def.icon,
        ...(note === undefined ? {} : { note }),
        ...(card.sheetUrl ? { sheet: { href: card.sheetUrl, label: ctx.t("openSheet") } } : {}),
        selectLabel: ctx.t("selectHint"),
        switchLabel: ctx.t("switchLabel"),
        switchName: `automation-${card.key}`,
        isSelected: card.key === ctx.selected,
        isEnabled: card.enabled,
        isSwitchDisabled: locked || (!startsAutomationConnection(status) && card.missing.length > 0),
        ...(accounts === undefined ? {} : { accounts }),
    }
}

/** The words of one filter chip: a fixed word, or the name of a module. */
export const automationFilterLabel = (
    key: AutomationFilterKey,
    t: AutomationsTranslator,
    locale: AutomationsLanguage,
): string => {
    const known = FILTER_LABEL[key]
    if (known !== undefined) return t(known)
    const module = moduleOfAutomationFilter(key)
    return module === null ? key : automationText(MODULE_REGISTRY[module].name, locale)
}

/** Why the collection is empty, or undefined when it is not. */
export const automationEmptyText = (
    shown: number,
    filter: AutomationFilterKey,
    isNested: boolean,
    t: AutomationsTranslator,
): string | undefined => {
    if (shown > 0) return undefined
    if (filter !== "all") return t("emptyFiltered")
    return isNested ? t("moduleEmpty") : t("emptyAll")
}
