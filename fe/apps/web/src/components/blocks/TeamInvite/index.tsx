"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { NO_STAFF, ROLE_KEYS, isTeamManager, teamSlotOf, useInviteCommands, useTeam } from "@/hooks/team"
import type { InviteSentView } from "@/hooks/team"
import { useInviteForm } from "@/hooks/rhf"
import { useIndividualPlan } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { useSlotLabels } from "@/hooks/slot"
import { TeamInviteBase } from "./component"

/** State values and commands consumed by the connected surface. */
type TeamInviteControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"team">>
    readonly member: ReturnType<typeof useMember>
    readonly isIndividual: ReturnType<typeof useIndividualPlan>
    readonly isAllowed: boolean
    readonly team: ReturnType<typeof useTeam>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly commands: ReturnType<typeof useInviteCommands>
    readonly form: ReturnType<typeof useInviteForm>
    readonly sent: InviteSentView | undefined
    readonly setSent: React.Dispatch<React.SetStateAction<InviteSentView | undefined>>
    readonly isCopied: boolean
    readonly setCopied: React.Dispatch<React.SetStateAction<boolean>>
}

const createTeamInviteState = (input: TeamInviteControllerInput) => {
    const { t, commands, form, setSent, setCopied } = input

    const submit = form.handleSubmit(async (values) => {
        setSent(undefined)
        setCopied(false)
        const result = await commands.create({
            email: values.email,
            role: values.role,
            staffId: values.staffId === NO_STAFF ? null : values.staffId,
        })
        if (result === undefined) return
        setSent(result)
        form.reset({ ...form.getValues(), email: "", staffId: NO_STAFF })
    })

    const sentText = (view: InviteSentView): string => {
        if (view.delivery === "invited") return t("sentEmail", { email: view.email })
        if (view.delivery === "existing") return t("sentNoticeExisting", { email: view.email })
        return t("sentNoEmail", { email: view.email })
    }
    return { ...input, submit, sentText }
}

/** The connected invite form: sends the invitation through the back end GraphQL API (outcome toasted) and shows the copyable link. */
export const TeamInvite = () => {
    const t = useTranslations("team")
    const member = useMember()
    const isIndividual = useIndividualPlan(member?.workspaceId)
    const isAllowed = member !== null && isTeamManager(member.role) && !isIndividual
    const slotLabels = useSlotLabels()
    const team = useTeam(member?.workspaceId ?? "", isAllowed)
    const commands = useInviteCommands()
    const form = useInviteForm()
    const [sent, setSent] = useState<InviteSentView>()
    const [isCopied, setCopied] = useState(false)
    const context = createTeamInviteState({
        t,
        member,
        isIndividual,
        isAllowed,
        team,
        slotLabels,
        commands,
        form,
        sent,
        setSent,
        isCopied,
        setCopied,
    })

    if (!isAllowed) return null
    return <TeamInviteBase {...createTeamInviteView(context)} />
}

const createTeamInviteView = (
    context: ReturnType<typeof createTeamInviteState>,
): React.ComponentProps<typeof TeamInviteBase> => {
    const { t, team, slotLabels, commands, form, sent, setCopied, submit, sentText, isCopied } = context
    return {
        props: {
            title: t("formTitle"),
            description: t("formDesc"),
            emailLabel: t("fieldEmail"),
            roleLabel: t("fieldRole"),
            staffLabel: t("fieldStaff"),
            staffHint: t("staffHint"),
            submitLabel: t("submit"),
            failTitle: t("errGeneric"),
            roleOptions: [
                { id: "staff", label: t(ROLE_KEYS.staff) },
                { id: "manager", label: t(ROLE_KEYS.manager) },
            ],
            email: form.watch("email"),
            role: form.watch("role"),
            staffId: form.watch("staffId"),
            isPending: commands.isPending,
            slot: teamSlotOf(team, [
                { id: NO_STAFF, label: t("staffNone") },
                ...team.views.staffChoices.map((staff) => ({
                    id: staff.id,
                    label: staff.role === "" ? staff.name : t("staffOption", { name: staff.name, role: staff.role }),
                })),
            ]),
            placeholder: [{ id: NO_STAFF, label: "-" }],
            slotLabels: slotLabels(t("staffNone")),
            error: form.formState.errors.email?.message,
            sent:
                sent === undefined
                    ? undefined
                    : {
                          text: sentText(sent),
                          link: sent.link,
                          linkLabel: t("sentLink"),
                          copyLabel: t("inviteCopy"),
                          copiedLabel: t("inviteCopied"),
                          isCopied,
                      },
        },
        on: {
            retry: team.reload,
            setEmail: (value) => form.setValue("email", value, { shouldValidate: form.formState.isSubmitted }),
            setRole: (value) => {
                if (value === "manager" || value === "staff") form.setValue("role", value)
            },
            setStaffId: (value) => form.setValue("staffId", value ?? NO_STAFF),
            submit: () => void submit(),
            copied: () => setCopied(true),
        },
    }
}
