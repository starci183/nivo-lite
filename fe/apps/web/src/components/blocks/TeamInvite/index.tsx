"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { NO_STAFF, ROLE_KEYS, outcomeErrorKey, useInviteCommands } from "@/hooks/team"
import type { InviteSentView, StaffChoiceView } from "@/hooks/team"
import { navigation } from "@/modules/i18n"
import { TeamInviteBase } from "./component"

/** Props for the connected invite form. */
interface TeamInviteProps {
    readonly workspaceId: string
    /** Active staff rows nobody is linked to yet. */
    readonly staffChoices: ReadonlyArray<StaffChoiceView>
    /** True while the page loads: the form keeps its labels and shows skeletons. */
    readonly isLoading?: boolean
}

/** The connected invite form: sends the invitation through the back end api and shows the copyable link. */
export const TeamInvite = (props: TeamInviteProps) => {
    const t = useTranslations("team")
    const router = navigation.useRouter()
    const commands = useInviteCommands(props.workspaceId)
    const [isPending, startTransition] = useTransition()
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<"manager" | "staff">("staff")
    const [staffId, setStaffId] = useState(NO_STAFF)
    const [error, setError] = useState<string>()
    const [sent, setSent] = useState<InviteSentView>()
    const [isCopied, setCopied] = useState(false)

    const submit = () => {
        setError(undefined)
        setSent(undefined)
        setCopied(false)
        startTransition(async () => {
            const result = await commands.create({ email, role, staffId: staffId === NO_STAFF ? null : staffId })
            if (result.kind !== "ok") return setError(t(outcomeErrorKey(result)))
            setSent(result.value)
            setEmail("")
            setStaffId(NO_STAFF)
            router.refresh()
        })
    }

    const sentText = (view: InviteSentView): string => {
        if (view.delivery === "invited") return t("sentEmail", { email: view.email })
        if (view.delivery === "existing") return t("sentNoticeExisting", { email: view.email })
        return t("sentNoEmail", { email: view.email })
    }

    return (
        <TeamInviteBase
            props={{
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
                staffOptions: [
                    { id: NO_STAFF, label: t("staffNone") },
                    ...props.staffChoices.map((staff) => ({
                        id: staff.id,
                        label:
                            staff.role === "" ? staff.name : t("staffOption", { name: staff.name, role: staff.role }),
                    })),
                ],
                email,
                role,
                staffId,
                isPending,
                isSkeleton: props.isLoading ?? false,
                error,
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
            }}
            on={{
                setEmail,
                setRole: (value) => {
                    if (value === "manager" || value === "staff") setRole(value)
                },
                setStaffId: (value) => setStaffId(value ?? NO_STAFF),
                submit,
                copied: () => setCopied(true),
            }}
        />
    )
}
