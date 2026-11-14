import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { Choice } from "../../rows/decision-choices"
import type { DecisionQueueView } from "../../views/views.types"
import type { OrderPickerWords } from "./OrderPicker"

/** Turns a spec text into the words of the viewer. */
type Words = (text: SpecText) => string

/** The amount in VND of the payment a row of the queue is about; zero when the queue is not read or the row has none. */
export const amountOf = (queue: DataSlot<DecisionQueueView>, rowId: string | null): number => {
    if (!("items" in queue)) return 0
    return queue.items.rows.find((row) => row.id === rowId)?.amountValue ?? 0
}

/** The words of the picker of an open choice; null when it is not a pick. */
export const pickWordsOf = (choice: Choice | null, words: Words): OrderPickerWords | null =>
    choice?.pick === undefined
        ? null
        : {
              title: words(choice.pick.title),
              searchLabel: words(choice.pick.searchLabel),
              clearLabel: words({ key: "searchClear" }),
              emptyBody: words(choice.pick.emptyBody),
              closeLabel: words({ key: "pickerClose" }),
              exact: words({ key: "pickerMatchExact" }),
              near: words({ key: "pickerMatchNear" }),
          }

/** The words of the confirmation of an open choice; null when it is not one. */
export const confirmWordsOf = (
    choice: Choice | null,
    words: Words,
): { readonly title: string; readonly body: string; readonly confirm: string; readonly cancel: string } | null =>
    choice?.confirm === undefined
        ? null
        : {
              title: words(choice.confirm.title),
              body: words(choice.confirm.body),
              confirm: words(choice.confirm.confirmLabel),
              cancel: words(choice.confirm.cancelLabel),
          }
