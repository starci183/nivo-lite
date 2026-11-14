"use client"

import { useAgentRoute } from "@/hooks/installations"
import { useTranslations } from "next-intl"
import { useAgentGeneralDraft, useAgentInstallation, useHoursEditor } from "@/hooks/agentSettings"
import { AgentGeneralFormBase, type AgentGeneralFormBaseProps } from "./component"

/** The instance the form sets and what its type is. */
type AgentGeneralFormProps = {
    readonly installationId?: string | undefined
    readonly module?: string | undefined
    /** The type has the reply limits (the chatbot). */
    readonly hasReplyLimits?: boolean | undefined
    /** The type never talks to customers: the after-hours note says so. */
    readonly isInternal?: boolean | undefined
}

type Translate = ReturnType<typeof useTranslations<"agentGeneral">>

const listOf = (t: Translate, key: "dayShort" | "dayLong"): ReadonlyArray<string> => {
    const list: unknown = t.raw(key)
    return Array.isArray(list) ? list.map(String) : []
}

type HoursWords = AgentGeneralFormBaseProps["props"]["hours"]["words"]

/** The words of the working hours list. */
const wordsOf = (t: Translate): HoursWords => ({
    label: t("sublabelHours"),
    longDays: listOf(t, "dayLong"),
    closedLabel: t("dayClosed"),
    addLabel: t("rangeAdd"),
    removeLabel: t("rangeRemove"),
    splitLabel: t("rangeSplit"),
    fromLabel: t("rangeFrom"),
    toLabel: t("rangeTo"),
})

/** The connected general form: one draft for the name, the working hours and the reply limits, and one save for all of it. */
export const AgentGeneralForm = (props: AgentGeneralFormProps) => {
    const route = useAgentRoute(props)
    const hasReplyLimits = props.hasReplyLimits ?? route.hasReplyLimits
    const isInternal = props.isInternal ?? !route.answersCustomers
    const t = useTranslations("agentGeneral")
    const tm = useTranslations("modulesCore")
    const { slot } = useAgentInstallation(route.installationId, route.module)
    const agent = "items" in slot ? slot.items : undefined
    const draft = useAgentGeneralDraft(route.installationId, agent, hasReplyLimits)
    const editor = useHoursEditor(draft.week, draft.setWeek)
    return (
        <AgentGeneralFormBase
            props={{
                formLabel: t("formLabel"),
                nameLabel: t("nameLabel"),
                name: draft.name,
                aliasLabel: t("aliasLabel"),
                alias: agent === undefined ? "" : `@${agent.agentHandle}`,
                afterHoursTitle: t("afterHoursLabel"),
                afterHours: draft.afterHours,
                afterHoursDescription: isInternal ? t("afterHoursInternal") : t("afterHoursNote"),
                hours: { words: wordsOf(t), rows: editor.rows, startOptions: editor.startOptions, endOptions: editor.endOptions },
                reply: draft.hasReply
                    ? {
                          title: t("sublabelReply"),
                          description: t("replyNote"),
                          holdingLabel: tm("holdingLabel"),
                          holdingPlaceholder: tm("holdingDefault"),
                          holding: draft.holding,
                      }
                    : null,
                isDisabled: draft.isDisabled,
                isPending: draft.isPending,
                isDirty: draft.isDirty,
                canSave: draft.canSave,
                dirtyLabel: t("dirty"),
                cancelLabel: t("cancel"),
                saveLabel: t("save"),
            }}
            on={{
                name: draft.setName,
                afterHours: draft.setAfterHours,
                addRange: editor.add,
                removeRange: editor.remove,
                editRange: editor.edit,
                splitRange: editor.split,
                holding: draft.setHolding,
                cancel: draft.cancel,
                save: () => void draft.save(),
            }}
        />
    )
}
