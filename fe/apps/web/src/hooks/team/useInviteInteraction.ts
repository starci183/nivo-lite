"use client"

import { useTranslations } from "next-intl"
import { useState, type SetStateAction, type Dispatch } from "react"
import { toast } from "@/modules/toast"
import type { InviteAction } from "@/modules/types"
import type { InviteShown } from "@/modules/team"
import { useCopyInviteLink } from "./useCopyInviteLink"
import { useInviteCommands, type InviteCommands } from "./useInviteCommands"

type UseInviteInteractionResult = {
    commands: InviteCommands
    busyId: string | undefined
    busyAction: InviteAction | null
    shown: InviteShown | undefined
    revokingId: string | undefined
    resend: (id: string) => void
    copyLink: (id: string) => void
    confirmRevoke: () => void
    revoke: Dispatch<SetStateAction<string | undefined>>
    cancelRevoke: () => void
    linkCopied: () => void
}

/** Owns invitation interaction; command refusals remain toasted by their existing command owner. */
export const useInviteInteraction = (): UseInviteInteractionResult => {
    const commands = useInviteCommands()
    const copy = useCopyInviteLink()
    const tToast = useTranslations("toast")
    const [busyId, setBusyId] = useState<string>()
    const [busyAction, setBusyAction] = useState<InviteAction | null>(null)
    const [shown, setShown] = useState<InviteShown>()
    const [revokingId, setRevokingId] = useState<string>()
    const reportFailure = (error: unknown) =>
        toast.danger(tToast("errorTitle"), {
            description: error instanceof Error && error.message ? error.message : tToast("defaultError"),
        })
    const linkCopied = (): void =>
        setShown((current) => (current === undefined ? current : { ...current, isCopied: true }))
    const run = async <T>(
        id: string,
        action: InviteAction,
        job: () => Promise<T | undefined>,
        after: (result: T) => void | Promise<void>,
    ): Promise<void> => {
        setBusyId(id)
        setBusyAction(action)
        let result: T | undefined
        try {
            result = await job()
        } finally {
            setBusyId(undefined)
            setBusyAction(null)
        }
        if (result !== undefined) await after(result)
    }
    const resend = (id: string): void => {
        run(
            id,
            "resend",
            () => commands.resend(id),
            (result) => {
                setShown({ id, email: result.email, link: result.link, isCopied: false })
            },
        ).catch(reportFailure)
    }
    const copyLink = (id: string): void => {
        run(
            id,
            "copy",
            () => commands.copyLink(id),
            async (result) => {
                setShown({ id, email: result.email, link: result.link, isCopied: false })
                if (await copy(result.link)) linkCopied()
            },
        ).catch(reportFailure)
    }
    const confirmRevoke = (): void => {
        if (revokingId === undefined) return
        run(
            revokingId,
            "revoke",
            () => commands.revoke(revokingId),
            (revoked) => {
                if (revoked) {
                    setShown(undefined)
                    setRevokingId(undefined)
                }
            },
        ).catch(reportFailure)
    }
    return {
        commands,
        busyId,
        busyAction,
        shown,
        revokingId,
        resend,
        copyLink,
        confirmRevoke,
        revoke: setRevokingId,
        cancelRevoke: (): void => setRevokingId(undefined),
        linkCopied,
    }
}
