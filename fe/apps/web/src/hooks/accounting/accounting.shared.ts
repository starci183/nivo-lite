import type { DecisionLock } from "./useAccountingDecisionLock"
import type { useAccountingQuestionsForm } from "@/hooks/rhf"
import type { MutateDecideWorkItemRequest } from "@/hooks/swr"
import type {
    AccountingMeasure,
    AccountingQuestion,
    AccountingQuestionCardData,
    AccountingQuestionGroup,
    AccountingQuestionsView,
    AccountingQuestionValues,
    AccountingWorkbenchData,
    FlowWorkItemView,
} from "@/modules/types"
import {
    accountingQuestionDefaults,
    accountingQuestionDisplay,
    accountingQuestionEdits,
    accountingQuestionError,
    moneyOf,
    type AccountingFormat,
    type AccountingTranslator,
} from "@/modules/utils"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import type { useFormatter, useTranslations } from "next-intl"
import type { ValuesInput1 } from "./useAccountingQuestions"

/** Presents the backend-calculated monthly figures in the reader's locale; a figure fed by a missing connection says so, never 0. */
export const accountingFiguresOf = (
    data: AccountingWorkbenchData,
    format: AccountingFormat,
    t: AccountingTranslator,
): ReadonlyArray<DescriptionListStatItem> => {
    const moneyItem = (
        id: string,
        term: string,
        measure: AccountingMeasure,
        unit: "countInvoices" | "countPayments",
    ) => ({ id, term, description: moneyOf(format, measure.vnd), meta: t(unit, { n: measure.count }) })
    const slots = [data.ageing.d0, data.ageing.d30, data.ageing.d60]
    return [
        moneyItem("income", t("mIncome"), data.periods.this.income, "countInvoices"),
        moneyItem("receivable", t("mReceivable"), data.periods.this.receivable, "countInvoices"),
        data.creditsSource === null
            ? { id: "unmatched", term: t("mUnmatched"), description: t("notConnected"), meta: t("notConnectedHint") }
            : moneyItem("unmatched", t("mUnmatched"), data.periods.this.unmatched, "countPayments"),
        {
            id: "ageing",
            term: t("mAgeing"),
            description: slots.map((slot) => slot.count).join(" / "),
            meta: slots.map((slot) => moneyOf(format, slot.vnd)).join(" · "),
        },
    ]
}

/** Presents the grouped questions and their empty-state copy. */
export const propsOf = (
    accounting: ReturnType<typeof useTranslations<"workbenchAccounting">>,
    cards: { group: AccountingQuestionGroup; data: AccountingQuestionCardData }[],
): AccountingQuestionsView["props"] => {
    return {
        intro: accounting("questionsIntro"),
        empty: accounting("questionsEmpty"),
        emptyBody: accounting("questionsEmptyBody"),
        groups: GROUPS.map((group) => ({
            id: group,
            title: accounting(`group_${group}`),
            hint: accounting(`groupHint_${group}`),
            items: cards.filter((card) => card.group === group).map((card) => card.data),
        })).filter((group) => group.items.length > 0),
    }
}
/** The resolved inputs for accounting questions actions input. */
interface AccountingQuestionsActionsInput {
    readonly items: FlowWorkItemView[]
    readonly canAct: (item: AccountingQuestion["item"]) => boolean
    readonly lock: DecisionLock
    readonly isDeciding: boolean
    readonly form: ReturnType<typeof useAccountingQuestionsForm>
    readonly getValues: ReturnType<typeof useAccountingQuestionsForm>["getValues"]
    readonly decide: (request: MutateDecideWorkItemRequest) => Promise<{ id: string; status: string } | undefined>
    readonly questions: readonly AccountingQuestion[]
    readonly values: ValuesInput1
    readonly ownerName: string
    readonly t: ReturnType<typeof useTranslations<"office">>
    readonly g: ReturnType<typeof useTranslations<"governance">>
    readonly format: ReturnType<typeof useFormatter>
    readonly editing: Record<string, boolean>
    readonly setValue: ReturnType<typeof useAccountingQuestionsForm>["setValue"]
}

/** Builds validated accounting decisions, question cards and edit handlers. */
export const createAccountingQuestionsActions = ({
    items,
    canAct,
    lock,
    isDeciding,
    form,
    getValues,
    decide,
    questions,
    values,
    ownerName,
    t,
    g,
    format,
    editing,
    setValue,
}: AccountingQuestionsActionsInput) => {
    const approve = async (id: string) => {
        const item = items.find((candidate) => candidate.id === id)
        if (!item || !canAct(item) || item.status !== "waiting_decision" || isDeciding || !lock.acquire()) return
        try {
            if (!(await form.trigger(`items.${id}`))) return
            const input = getValues(`items.${id}`)
            await decide({
                workItemId: id,
                decision: "approved",
                edits: accountingQuestionEdits(item, input),
                basis: item.action === "reconcile_payment" ? input.basis.trim() : undefined,
            })
        } finally {
            lock.release()
        }
    }
    const reject = async (id: string) => {
        const item = items.find((candidate) => candidate.id === id)
        if (
            !item ||
            !canAct(item) ||
            !["waiting_decision", "failed"].includes(item.status) ||
            isDeciding ||
            !lock.acquire()
        )
            return
        try {
            await decide({ workItemId: id, decision: "rejected" })
        } finally {
            lock.release()
        }
    }
    const cards = questions.map((question) => {
        const item = question.item
        const allowed = canAct(item)
        const defaults = accountingQuestionDefaults(item)
        const current = values.items?.[item.id]
        const input: AccountingQuestionValues = {
            ...defaults,
            ...current,
            fields: Object.fromEntries(
                Object.keys(defaults.fields).map((name) => [name, current?.fields?.[name] ?? ""]),
            ),
        }
        return {
            group: question.group,
            data: accountingQuestionDisplay({
                item,
                ownerName,
                values: input,
                t,
                g,
                format,
                canAct: allowed,
                isBusy: isDeciding || !allowed,
                isEditing: editing[item.id] ?? false,
                error: accountingQuestionError(form.formState.errors.items?.[item.id] ?? {}),
            }),
        }
    })
    const change = (id: string, name: Exclude<keyof AccountingQuestionValues, "fields">, value: string) =>
        setValue(`items.${id}.${name}`, value, { shouldDirty: true })
    return { cards, approve, reject, change }
}

/** The order in which accounting question groups are presented. */
export const GROUPS: ReadonlyArray<AccountingQuestionGroup> = ["unclear_payment", "over_limit", "missing_data", "other"]
