import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsPersonalViews["myShiftsData"]; readonly on: ShiftsPersonalActions["myShifts"] }
type SwapForm = ShiftsPersonalViews["myShiftsSwapForm"]

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"

const NO_SWAP: SwapForm = { shiftId: null, toStaffId: "", reason: "" }

type UseShiftsMyShiftsViewResult =
    | {
          copy: Omit<
              {
                  readonly notice: {
                      readonly title: string
                      readonly body: string
                  } | null
                  readonly title: string
                  readonly hint: string
                  readonly emptyTitle: string
                  readonly emptyBody: string
                  readonly checkInLabel: string
                  readonly checkedInLabel: string
                  readonly askSwapLabel: string
                  readonly swapWithLabel: string
                  readonly pickPersonLabel: string
                  readonly reasonLabel: string
                  readonly sendLabel: string
                  readonly shifts: ReadonlyArray<ShiftsPersonalViews["myShiftsMyShiftView"]>
                  readonly swap: ShiftsPersonalViews["myShiftsSwapForm"]
                  readonly swapOptions: ReadonlyArray<{
                      readonly id: string
                      readonly label: string
                  }>
              },
              "shifts" | "notice" | "swapOptions"
          >
          data: undefined
          on: undefined
      }
    | {
          copy: Omit<
              {
                  readonly notice: {
                      readonly title: string
                      readonly body: string
                  } | null
                  readonly title: string
                  readonly hint: string
                  readonly emptyTitle: string
                  readonly emptyBody: string
                  readonly checkInLabel: string
                  readonly checkedInLabel: string
                  readonly askSwapLabel: string
                  readonly swapWithLabel: string
                  readonly pickPersonLabel: string
                  readonly reasonLabel: string
                  readonly sendLabel: string
                  readonly shifts: ReadonlyArray<ShiftsPersonalViews["myShiftsMyShiftView"]>
                  readonly swap: ShiftsPersonalViews["myShiftsSwapForm"]
                  readonly swapOptions: ReadonlyArray<{
                      readonly id: string
                      readonly label: string
                  }>
              },
              "shifts" | "notice" | "swapOptions"
          >
          data: Pick<
              {
                  readonly notice: {
                      readonly title: string
                      readonly body: string
                  } | null
                  readonly title: string
                  readonly hint: string
                  readonly emptyTitle: string
                  readonly emptyBody: string
                  readonly checkInLabel: string
                  readonly checkedInLabel: string
                  readonly askSwapLabel: string
                  readonly swapWithLabel: string
                  readonly pickPersonLabel: string
                  readonly reasonLabel: string
                  readonly sendLabel: string
                  readonly shifts: ReadonlyArray<ShiftsPersonalViews["myShiftsMyShiftView"]>
                  readonly swap: ShiftsPersonalViews["myShiftsSwapForm"]
                  readonly swapOptions: ReadonlyArray<{
                      readonly id: string
                      readonly label: string
                  }>
              },
              "shifts" | "notice" | "swapOptions"
          >
          on: {
              readonly checkIn: (id: string) => void
              readonly toggleSwap: (id: string) => void
              readonly target: (id: string) => void
              readonly reason: (text: string) => void
              readonly send: (id: string) => void
          }
      }

/** My upcoming shifts: check in on the day, and ask a colleague to swap one. */
export const useShiftsMyShiftsView = (input: ShiftsPanelInput): UseShiftsMyShiftsViewResult => {
    const t = useTranslations("shifts")
    const mine = input.mine.data
    const bench = input.bench.data
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const [swap, setSwap] = useState<SwapForm>(NO_SWAP)
    const operation = useShiftsOperation(input)
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setSwap(NO_SWAP)
        },
    })

    const copy: ShiftsPersonalViews["myShiftsCopy"] = {
        title: t("mineUpcoming"),
        hint: t("mineUpcomingHint"),
        emptyTitle: t("mineNone"),
        emptyBody: t("mineNoneBody"),
        checkInLabel: t("checkIn"),
        checkedInLabel: t("checkedIn"),
        askSwapLabel: t("askSwap"),
        swapWithLabel: t("swapWith"),
        pickPersonLabel: t("pickPerson"),
        reasonLabel: t("reason"),
        sendLabel: t("sendRequest"),
        swap,
    }

    if (mine === undefined || bench === undefined) return { copy, data: undefined, on: undefined }

    const positionName = (id: string): string =>
        bench.setup.positions.find((position) => position.id === id)?.name ?? ""

    const send = async (shiftId: string) => {
        const isCurrent = operation.capture()

        const done = await operation.run(shiftId, () => commands.requestSwap(shiftId, swap.toStaffId, swap.reason))
        if (done && isCurrent()) setSwap(NO_SWAP)
    }
    const open = mine.myShifts.find((shift) => shift.id === swap.shiftId)

    const view: FullView = {
        props: {
            notice: mine.profileId === null ? { title: t("noProfileTitle"), body: t("noProfileBody") } : null,
            shifts: mine.myShifts.map((shift) => ({
                id: shift.id,
                title: `${format.dayFull(shift.date)} · ${shift.start}-${shift.end}`,
                notes: [
                    shift.status === "swapped"
                        ? `${positionName(shift.positionId)} · ${t("swappedTag")}`
                        : positionName(shift.positionId),
                ],
                isCheckedIn: shift.checkedIn,
                canCheckIn: shift.date === mine.today,
                isBusy: operation.isPending(shift.id),
            })),
            swapOptions:
                open === undefined
                    ? []
                    : mine.colleagues
                          .filter((person) => person.positionIds.includes(open.positionId))
                          .map((person) => ({ id: person.id, label: person.name })),
        },
        on: {
            checkIn: (id) => operation.observe(operation.run(id, () => commands.checkIn(id))),
            toggleSwap: (id) => setSwap(swap.shiftId === id ? NO_SWAP : { shiftId: id, toStaffId: "", reason: "" }),
            target: (id) => setSwap((current) => ({ ...current, toStaffId: id })),
            reason: (text) => setSwap((current) => ({ ...current, reason: text })),
            send: (id) => operation.observe(send(id)),
        },
    }

    return { copy, data: view.props, on: view.on }
}
