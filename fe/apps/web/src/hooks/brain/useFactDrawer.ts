"use client"

import { useTranslations } from "next-intl"
import { SCOPE_KEY, TYPE_KEY } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import { FACT_SUBJECT_TYPES } from "@/modules/types"
import type { FactDrawerView, FactScope, FactSubjectType } from "@/modules/types"
import { useBrainCommand } from "./useBrainCommand"
import { useBrainForm } from "./useBrainForm"
import { useFactForm } from "./useFactForm"
import { useFailureToast } from "./useFailureToast"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the address asks of the fact drawer, and the tab it returns to when it closes. */
interface FactDrawerAddress {
    /** The `fact` of the address: a new fact is being written. */
    readonly fact: string | undefined
    /** The `edit` of the address: the fact in force that gets a new value. */
    readonly edit: string | undefined
    /** The `answer` of the address: the customer question the fact answers. */
    readonly answer: string | undefined
    readonly tab: BrainTab
}

const SCOPES: ReadonlyArray<FactScope> = ["public", "internal", "restricted"]

/** The catalog key (`brainFacts` namespace) of the line that says what a scope means. */
const SCOPE_HINT_KEY = {
    public: "scopeHintPublic",
    internal: "scopeHintInternal",
    restricted: "scopeHintRestricted",
} as const satisfies Readonly<Record<FactScope, string>>

const subjectTypeOf = (value: string | null, fallback: FactSubjectType): FactSubjectType =>
    FACT_SUBJECT_TYPES.find((type) => type === value) ?? fallback

const scopeOf = (value: string, fallback: FactScope): FactScope => SCOPES.find((scope) => scope === value) ?? fallback

type Translate = ReturnType<typeof useTranslations<"brain">>
type FactsTranslate = ReturnType<typeof useTranslations<"brainFacts">>
type Words = Pick<
    FactDrawerView["props"],
    | "closeLabel"
    | "cancelLabel"
    | "saveLabel"
    | "failTitle"
    | "typeLabel"
    | "selectPlaceholder"
    | "typeOptions"
    | "subjectLabel"
    | "subjectHint"
    | "attributeLabel"
    | "attributeHint"
    | "valueLabel"
    | "scopeLabel"
    | "scopeOptions"
    | "modulesLabel"
    | "fromLabel"
    | "toLabel"
    | "noteLabel"
    | "toPlaceholder"
    | "notePlaceholder"
>

/** The words of the drawer: its labels, hints and choices. */
const wordsOf = (t: Translate, f: FactsTranslate): Words => ({
    closeLabel: t("cancel"),
    cancelLabel: t("cancel"),
    saveLabel: t("save"),
    failTitle: t("loadFailed"),
    typeLabel: t("fSubjectType"),
    selectPlaceholder: t("selectPlaceholder"),
    typeOptions: FACT_SUBJECT_TYPES.map((type) => ({ id: type, label: t(TYPE_KEY[type]) })),
    subjectLabel: t("fSubject"),
    subjectHint: t("fSubjectHint"),
    attributeLabel: t("fAttribute"),
    attributeHint: t("fAttributeHint"),
    valueLabel: t("fValue"),
    scopeLabel: t("fScope"),
    scopeOptions: SCOPES.map((scope) => ({ id: scope, label: t(SCOPE_KEY[scope]) })),
    modulesLabel: t("fModules"),
    fromLabel: t("fValidFrom"),
    toLabel: t("fValidTo"),
    noteLabel: t("fNote"),
    toPlaceholder: f("toPlaceholder"),
    notePlaceholder: f("notePlaceholder"),
})

/**
 * The drawer that writes a fact (or a new value for one in force, or the answer to a customer question): reads what the address
 * asks for, opens and closes through the address and sends the fact to the back end as a mutation. Null where the member may not
 * write.
 */
export const useFactDrawer = (input: FactDrawerAddress): FactDrawerView | null => {
    const t = useTranslations("brain")
    const f = useTranslations("brainFacts")
    const failed = useFailureToast()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const address = useBrainForm(input)
    const form = useFactForm(address.editing, address.preset, address.formKey)
    const command = useBrainCommand()
    const close = () => router.replace(workspaceHref(workspaceId, brainTabHref(input.tab)))
    const submit = () => {
        if (!form.isComplete) return
        command.send("fact.save", form.payload(address.preset?.gapId), { onResult: close }).catch(() => {
            failed()
        })
    }
    const { state } = form
    if (!address.canWrite) return null
    const editing = address.editing
    const question = address.preset?.question
    return {
        props: {
            ...wordsOf(t, f),
            title:
                editing === null
                    ? t("formTitleNew")
                    : t("formTitleEdit", { subject: editing.subjectLabel, attribute: editing.attributeLabel }),
            isOpen: address.isOpen,
            isPending: command.isPending,
            question: question === undefined ? undefined : t("gapAnswerFor", { question }),
            context:
                editing === null
                    ? undefined
                    : f("drawerContext", {
                          title: `${editing.subjectLabel} · ${editing.attributeLabel}`,
                          value: editing.unit === null ? editing.value : `${editing.value} ${editing.unit}`,
                      }),
            isEditing: editing !== null,
            scopeHint: f(SCOPE_HINT_KEY[state.scope]),
            moduleOptions: address.lenses.map((lens) => ({ id: lens.module, label: lens.name })),
            subjectType: state.subjectType,
            subject: state.subjectLabel,
            attribute: state.attributeLabel,
            value: state.value,
            scope: state.scope,
            modules: state.modules,
            validFrom: state.validFrom,
            validTo: state.validTo,
            note: state.note,
        },
        on: {
            close,
            submit,
            setType: (value) => form.set("subjectType", subjectTypeOf(value, state.subjectType)),
            setSubject: (value) => form.set("subjectLabel", value),
            setAttribute: (value) => form.set("attributeLabel", value),
            setValue: (value) => form.set("value", value),
            setScope: (value) => form.set("scope", scopeOf(value, state.scope)),
            setModules: (value) => form.set("modules", value),
            setFrom: (value) => form.set("validFrom", value),
            setTo: (value) => form.set("validTo", value),
            setNote: (value) => form.set("note", value),
        },
    }
}
