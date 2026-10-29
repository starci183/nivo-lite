"use client"

import { useMemo } from "react"
import { useQueryLoadImapConnectionSwr } from "@/hooks/swr"
import { securityOf } from "./imap-wizard.shared"
import type { ImapMailbox } from "./imap-wizard.shared"

/** The saved mailbox a wizard resumes: `loading` while it is read, `view` once it is, `error` with the back end message. */
export const useImapMailbox = (resumeId: string | undefined) => {
    const saved = useQueryLoadImapConnectionSwr(resumeId)
    const data = saved.data
    const view = useMemo<ImapMailbox | undefined>(
        () =>
            data === undefined
                ? undefined
                : {
                      id: data.id,
                      name: data.name,
                      email: data.email,
                      host: data.host,
                      port: data.port,
                      security: securityOf(data.security),
                      user: data.user,
                      folders: data.folders,
                      sinceDays: data.sinceDays,
                      syncEveryMinutes: data.syncEveryMinutes ?? null,
                      agentIds: data.agentIds,
                  },
        [data],
    )
    return {
        loading: resumeId !== undefined && saved.isLoading,
        view,
        error: saved.error instanceof Error ? saved.error.message : null,
        reload: () => void saved.mutate(),
    }
}
