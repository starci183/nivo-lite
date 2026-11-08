"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useInviteForm } from "@/hooks/rhf"
import { NO_STAFF, useInviteCommands, type InviteSentView } from "@/hooks/team"

/** The invite drawer's state and commands: open or closed, the form, the invitation just made and the copy mark. */
export interface TeamInviteDrawerState {
    readonly isOpen: boolean
    readonly form: ReturnType<typeof useInviteForm>
    readonly sent: InviteSentView | undefined
    readonly isCopied: boolean
    readonly isPending: boolean
    readonly open: () => void
    readonly close: () => void
    readonly submit: () => void
    readonly markCopied: () => void
}

/** Owns the invite drawer: sending an invitation shows its link once, closing the drawer clears the form for the next one. */
export const useTeamInviteDrawer = (): TeamInviteDrawerState => {
    const commands = useInviteCommands()
    const form = useInviteForm()
    const params = useSearchParams()
    const staffParam = params.get("invite_staff")
    const [isOpen, setIsOpen] = useState(() => params.has("invite") || staffParam !== null)
    const [sent, setSent] = useState<InviteSentView>()
    const [isCopied, setIsCopied] = useState(false)
    useEffect(() => {
        if (staffParam !== null) form.setValue("staffId", staffParam)
    }, [form, staffParam])
    const send = form.handleSubmit(async (values) => {
        setIsCopied(false)
        const result = await commands.create({
            email: values.email,
            role: values.role,
            staffId: values.staffId === NO_STAFF ? null : values.staffId,
        })
        if (result === undefined) return
        setSent(result)
        form.reset({ ...form.getValues(), email: "", staffId: NO_STAFF })
    })
    return {
        isOpen,
        form,
        sent,
        isCopied,
        isPending: commands.isPending,
        open: () => setIsOpen(true),
        close: () => {
            setIsOpen(false)
            setSent(undefined)
            setIsCopied(false)
        },
        submit: () => void send(),
        markCopied: () => setIsCopied(true),
    }
}
