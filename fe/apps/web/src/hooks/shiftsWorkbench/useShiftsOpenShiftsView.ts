import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = {
    readonly props: ShiftsPersonalViews["openShiftsData"]
    readonly on: ShiftsPersonalActions["openShifts"]
}

import { useTranslations } from "next-intl"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"

type UseShiftsOpenShiftsViewResult =
    | {
          copy: Omit<
              {
                  readonly title: string
                  readonly hint: string
                  readonly emptyLabel: string
                  readonly claimLabel: string
                  readonly shifts: ReadonlyArray<{
                      readonly id: string
                      readonly title: string
                      readonly notes: ReadonlyArray<string>
                      readonly isBusy: boolean
                  }>
              },
              "shifts"
          >
          data: undefined
          on: undefined
      }
    | {
          copy: Omit<
              {
                  readonly title: string
                  readonly hint: string
                  readonly emptyLabel: string
                  readonly claimLabel: string
                  readonly shifts: ReadonlyArray<{
                      readonly id: string
                      readonly title: string
                      readonly notes: ReadonlyArray<string>
                      readonly isBusy: boolean
                  }>
              },
              "shifts"
          >
          data: Pick<
              {
                  readonly title: string
                  readonly hint: string
                  readonly emptyLabel: string
                  readonly claimLabel: string
                  readonly shifts: ReadonlyArray<{
                      readonly id: string
                      readonly title: string
                      readonly notes: ReadonlyArray<string>
                      readonly isBusy: boolean
                  }>
              },
              "shifts"
          >
          on: {
              readonly claim: (id: string) => void
          }
      }

/** The open shifts nobody has yet, each with a button to ask for it. */
export const useShiftsOpenShiftsView = (input: ShiftsPanelInput): UseShiftsOpenShiftsViewResult => {
    const t = useTranslations("shifts")
    const mine = input.mine.data
    const bench = input.bench.data
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const operation = useShiftsOperation(input)
    const copy: ShiftsPersonalViews["openShiftsCopy"] = {
        title: t("openShifts"),
        hint: t("openShiftsHint"),
        emptyLabel: t("openNone"),
        claimLabel: t("claim"),
    }

    if (mine === undefined || bench === undefined || mine.profileId === null)
        return { copy, data: undefined, on: undefined }

    const positionName = (id: string): string =>
        bench.setup.positions.find((position) => position.id === id)?.name ?? ""

    const claim = async (id: string) => {
        await operation.run(id, () => commands.claimShift(id))
    }

    const view: FullView = {
        props: {
            shifts: mine.openShifts.map((shift) => ({
                id: shift.id,
                title: `${format.dayFull(shift.date)} · ${shift.start}-${shift.end}`,
                notes: [positionName(shift.positionId)],
                isBusy: operation.isPending(shift.id),
            })),
        },
        on: { claim: (id) => operation.observe(claim(id)) },
    }

    return { copy, data: view.props, on: view.on }
}
