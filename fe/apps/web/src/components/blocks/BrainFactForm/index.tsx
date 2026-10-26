"use client"

import { useTranslations } from "next-intl"
import { SCOPE_KEY, TYPE_KEY, useBrainCommand, useBrainForm, useFactForm } from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import { FACT_SUBJECT_TYPES } from "@/modules/types"
import type { FactScope, FactSubjectType } from "@/modules/types"
import { BrainFactFormBase } from "./component"

/** Props for the connected fact form: what the address asks of it. */
interface BrainFactFormProps {
    /** The `fact` of the address: a new fact is being written. */
    readonly fact: string | undefined
    /** The `edit` of the address: the fact in force that gets a new value. */
    readonly edit: string | undefined
    /** The `answer` of the address: the customer question the fact answers. */
    readonly answer: string | undefined
    /** The tab the form sits on and returns to when it closes. */
    readonly tab: BrainTab
}

const SCOPES: ReadonlyArray<FactScope> = ["public", "internal", "restricted"]

const subjectTypeOf = (value: string | null, fallback: FactSubjectType): FactSubjectType =>
    FACT_SUBJECT_TYPES.find((type) => type === value) ?? fallback

const scopeOf = (value: string, fallback: FactScope): FactScope => SCOPES.find((scope) => scope === value) ?? fallback

/** The connected fact form: reads what the address asks for, opens and closes through the address and sends the fact to the back end as a mutation. */
export const BrainFactForm = (props: BrainFactFormProps) => {
    const t = useTranslations("brain")
    const router = navigation.useRouter()
    const address = useBrainForm(props)
    const form = useFactForm(address.editing, address.preset, address.formKey)
    const command = useBrainCommand()
    const close = () => router.replace(brainTabHref(props.tab))
    const submit = () => {
        if (!form.isComplete) return
        command.send("fact.save", form.payload(address.preset?.gapId), { onResult: close })
    }
    const { state } = form
    if (!address.canWrite) return null
    return (
        <BrainFactFormBase
            props={{
                title:
                    address.editing === null
                        ? t("formTitleNew")
                        : t("formTitleEdit", {
                              subject: address.editing.subjectLabel,
                              attribute: address.editing.attributeLabel,
                          }),
                closeLabel: t("cancel"),
                cancelLabel: t("cancel"),
                saveLabel: t("save"),
                failTitle: t("loadFailed"),
                isOpen: address.isOpen,
                isPending: command.isPending,
                question:
                    address.preset?.question === undefined
                        ? undefined
                        : t("gapAnswerFor", { question: address.preset.question }),
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
                moduleOptions: address.lenses.map((lens) => ({ id: lens.module, label: lens.name })),
                fromLabel: t("fValidFrom"),
                toLabel: t("fValidTo"),
                noteLabel: t("fNote"),
                subjectType: state.subjectType,
                subject: state.subjectLabel,
                attribute: state.attributeLabel,
                value: state.value,
                scope: state.scope,
                modules: state.modules,
                validFrom: state.validFrom,
                validTo: state.validTo,
                note: state.note,
            }}
            on={{
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
            }}
        />
    )
}
