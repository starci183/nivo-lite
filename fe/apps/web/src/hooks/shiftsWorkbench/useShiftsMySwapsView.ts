interface SwapLineInput {
    readonly kind: string
    readonly from: string | null
    readonly to: string
    readonly shift: string
}
import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsPersonalViews["mySwapsData"]; readonly on: ShiftsPersonalActions["mySwaps"] }

import { useTranslations } from "next-intl"
import { requestStatusOf } from "@/hooks/shifts"

const LIST_LIMIT = 8

type UseShiftsMySwapsViewResult =
    | {
          copy: Omit<
              {
                  readonly title: string
                  readonly emptyLabel: string
                  readonly rows: ReadonlyArray<{
                      readonly id: string
                      readonly text: string
                      readonly tone: "success" | "neutral" | "warning"
                      readonly badge: string
                  }>
              },
              "rows"
          >
          data: undefined
          on: undefined
      }
    | {
          copy: Omit<
              {
                  readonly title: string
                  readonly emptyLabel: string
                  readonly rows: ReadonlyArray<{
                      readonly id: string
                      readonly text: string
                      readonly tone: "success" | "neutral" | "warning"
                      readonly badge: string
                  }>
              },
              "rows"
          >
          data: Pick<
              {
                  readonly title: string
                  readonly emptyLabel: string
                  readonly rows: ReadonlyArray<{
                      readonly id: string
                      readonly text: string
                      readonly tone: "success" | "neutral" | "warning"
                      readonly badge: string
                  }>
              },
              "rows"
          >
          on: Record<string, never>
      }

/** My swap and open-shift requests with their state. */
export const useShiftsMySwapsView = (input: ShiftsPanelInput): UseShiftsMySwapsViewResult => {
    const t = useTranslations("shifts")
    const mine = input.mine.data
    const copy: ShiftsPersonalViews["mySwapsCopy"] = { title: t("mySwaps"), emptyLabel: t("mySwapsEmpty") }

    if (mine?.profileId === undefined || mine.profileId === null) return { copy, data: undefined, on: undefined }

    const name = (id: string | null): string => mine.colleagues.find((person) => person.id === id)?.name ?? t("you")
    const lineOf = (input: SwapLineInput): string => {
        const { kind, from, to, shift } = input
        return kind === "claim"
            ? t("claimLine", { name: name(to), shift })
            : t("swapLine", { from: name(from), to: name(to), shift })
    }

    const view: FullView = {
        props: {
            rows: mine.swaps.slice(0, LIST_LIMIT).map((swap) => ({
                id: swap.id,
                text: lineOf({ kind: swap.kind, from: swap.fromStaffId, to: swap.toStaffId, shift: swap.shiftLine }),
                tone: requestStatusOf(swap.status).tone,
                badge: t(requestStatusOf(swap.status).key),
            })),
        },
        on: {},
    }
    return { copy, data: view.props, on: view.on }
}
