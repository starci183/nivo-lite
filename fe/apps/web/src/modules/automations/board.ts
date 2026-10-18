import type {
    AutomationCardView,
    AutomationRunView,
    AutomationsBoardView,
    AutomationsLanguage,
    AutomationsTranslator,
    PreviewSample,
    ShopContext,
} from "@/modules/types"
import type { ModuleKey } from "@/modules/catalog"
import { automationCardOf, automationEmptyText, automationFilterLabel } from "./cards"
import type { CardContext } from "./cards"
import { automationDetailOf } from "./detail"
import type { DetailInput } from "./detail"
import { automationFiltersFor, automationText, hiddenAutomations } from "./status"

/** What the board is drawn from. */
export interface BoardInput {
    readonly t: AutomationsTranslator
    readonly locale: AutomationsLanguage
    readonly moduleNames: Readonly<Partial<Record<ModuleKey, string>>>
    readonly when: (iso: string) => string
    readonly isNested: boolean
    /** Every card of the workspace, and the ones of this board's scope that pass the filter. */
    readonly cards: ReadonlyArray<AutomationCardView>
    readonly scoped: ReadonlyArray<AutomationCardView>
    readonly shown: ReadonlyArray<AutomationCardView>
    readonly filter: string
    readonly selected: string | null
    readonly busyKey: string | null
    readonly accounts: CardContext["accounts"]
    readonly runs: ReadonlyArray<AutomationRunView>
    readonly shop: ShopContext
    /** The sample values and neutral words of the message previews. */
    readonly sample: PreviewSample
    /** The open card with what the owner edits on it; absent while none is open. */
    readonly open: Omit<DetailInput, "card" | "runs" | "shop" | "sample" | "isBusy" | "isNested" | "errorText"> | null
    readonly current: AutomationCardView | null
    /** Why the last action was refused, already in words. */
    readonly errorText: string | undefined
}

/** The whole board as it is drawn: the filters, the cards that pass them, the open detail and the hidden ones. */
export const automationBoardOf = (input: BoardInput): AutomationsBoardView => {
    const { t, locale, current, open } = input
    const filters = automationFiltersFor(input.cards)
    const hidden = hiddenAutomations(input.scoped)
    const empty = automationEmptyText(input.shown.length, input.filter, input.isNested, t)
    const ctx = { t, locale, selected: input.selected, busyKey: input.busyKey, accounts: input.accounts }
    const detail =
        current === null || open === null
            ? undefined
            : automationDetailOf(
                  {
                      ...open,
                      card: current,
                      runs: input.runs.filter((run) => run.templateKey === current.key),
                      shop: input.shop,
                      sample: input.sample,
                      isBusy: input.busyKey === current.key,
                      isNested: input.isNested,
                      errorText: input.errorText,
                  },
                  { t, locale, when: input.when },
              )
    return {
        filters: {
            label: t("filtersLabel"),
            items: filters.map((key) => ({ id: key, label: automationFilterLabel(key, t, input.moduleNames) })),
            selectedId: input.filter,
        },
        ...(input.errorText !== undefined && current === null
            ? { errorAlert: { title: input.errorText, dismissLabel: t("detailClose") } }
            : {}),
        ...(empty === undefined ? {} : { emptyText: empty }),
        cards: input.shown.map((card) => automationCardOf(card, ctx)),
        ...(detail === undefined ? {} : { detail }),
        hidden: {
            title: t("hiddenCount", { n: hidden.length }),
            restoreLabel: t("restore"),
            items: hidden.map((card) => ({
                key: card.key,
                name: automationText(card.def.name, locale),
                isBusy: input.busyKey === card.key,
            })),
        },
    }
}
