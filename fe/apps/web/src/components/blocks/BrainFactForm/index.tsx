"use client"

import { useTranslations } from "next-intl"
import { SCOPE_KEY, TYPE_KEY, useBrainCommand, useFactForm } from "@/hooks/brain"
import type { FactPreset } from "@/hooks/brain"
import type { CommandActions } from "@/hooks/knowledge"
import { writeCommandWait } from "@/modules/db/knowledge/write-command-wait"
import { writeCommand } from "@/modules/db/knowledge/write-command"
import { navigation } from "@/modules/i18n"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import { FACT_SUBJECT_TYPES } from "@/modules/types"
import type { BrainFact, BrainLens, FactScope, FactSubjectType } from "@/modules/types"
import { BrainFactFormBase } from "./component"

/** Props for the connected fact form. */
interface BrainFactFormProps {
    readonly workspaceId: string
    /** Whether the address asks for the form to be open. */
    readonly isOpen: boolean
    /** The fact in force the form writes a new value for, or null for a new fact. */
    readonly editing: BrainFact | null
    /** The suggestion or customer question the form was opened from. */
    readonly preset: FactPreset | undefined
    /** The agents a restricted fact may be limited to. */
    readonly lenses: ReadonlyArray<BrainLens>
}

const SCOPES: ReadonlyArray<FactScope> = ["public", "internal", "restricted"]

const subjectTypeOf = (value: string | null, fallback: FactSubjectType): FactSubjectType =>
    FACT_SUBJECT_TYPES.find((type) => type === value) ?? fallback

const scopeOf = (value: string, fallback: FactScope): FactScope => SCOPES.find((scope) => scope === value) ?? fallback

const ACTIONS: CommandActions = { write: writeCommand, wait: writeCommandWait }

/** The connected fact form: opens and closes through the address and sends the fact to the back end as a command. */
export const BrainFactForm = (props: BrainFactFormProps) => {
    const t = useTranslations("brain")
    const router = navigation.useRouter()
    const form = useFactForm(props.editing, props.preset)
    const command = useBrainCommand(props.workspaceId, ACTIONS)
    const close = () => router.replace(KNOWLEDGE_ROUTES.brain)
    const submit = () => {
        if (!form.isComplete) return
        command.send("fact.save", form.payload(props.preset?.gapId), { onResult: close })
    }
    const note = command.note
    const { state } = form
    return (
        <BrainFactFormBase
            props={{
                title:
                    props.editing === null
                        ? t("formTitleNew")
                        : t("formTitleEdit", {
                              subject: props.editing.subjectLabel,
                              attribute: props.editing.attributeLabel,
                          }),
                closeLabel: t("cancel"),
                cancelLabel: t("cancel"),
                saveLabel: t("save"),
                failTitle: t("loadFailed"),
                isOpen: props.isOpen,
                isPending: command.isPending,
                question:
                    props.preset?.question === undefined
                        ? undefined
                        : t("gapAnswerFor", { question: props.preset.question }),
                typeLabel: t("fSubjectType"),
                typeOptions: FACT_SUBJECT_TYPES.map((type) => ({ id: type, label: t(TYPE_KEY[type]) })),
                subjectLabel: t("fSubject"),
                subjectHint: t("fSubjectHint"),
                attributeLabel: t("fAttribute"),
                attributeHint: t("fAttributeHint"),
                valueLabel: t("fValue"),
                scopeLabel: t("fScope"),
                scopeOptions: SCOPES.map((scope) => ({ id: scope, label: t(SCOPE_KEY[scope]) })),
                modulesLabel: t("fModules"),
                moduleOptions: props.lenses.map((lens) => ({ id: lens.module, label: lens.name })),
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
                error: note?.tone === "negative" ? t(note.text) : undefined,
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
