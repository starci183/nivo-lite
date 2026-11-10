"use client"

import { useState } from "react"
import { useMutateSaveWebsiteSiteSwr, useQueryWebsiteSiteSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { ALL_OPTION, embedSnippetOf } from "@/modules/inbox"
import type { InboxOptionView, InboxWebsiteView } from "@/modules/types"

/** The switches and the agent the owner changed in the drawer and has not saved yet. */
interface Draft {
    readonly tab?: string
    readonly chat?: boolean
    readonly form?: boolean
    readonly prices?: boolean
    readonly agent?: string
}

/** The website intake drawer and what it does. */
interface WebsiteIntake {
    readonly view: InboxWebsiteView
    readonly open: () => void
    readonly close: () => void
    readonly selectTab: (id: string) => void
    readonly setChat: (on: boolean) => void
    readonly setForm: (on: boolean) => void
    readonly setPrices: (on: boolean) => void
    readonly setAgent: (id: string) => void
    /** Saves the switches and turns the intake on. */
    readonly save: () => void
    /** The last save did not go through. */
    readonly failed: boolean
    /** Copies a text to the clipboard; answers whether it worked. */
    readonly copy: (text: string) => Promise<boolean>
}

/** Reads the website intake once its drawer opens and saves what the owner picks there. */
export const useWebsiteIntake = (agents: ReadonlyArray<InboxOptionView>): WebsiteIntake => {
    const workspaceId = useWorkspaceId()
    const [isOpen, setOpen] = useState(false)
    const [draft, setDraft] = useState<Draft>({})
    const [failed, setFailed] = useState(false)
    const read = useQueryWebsiteSiteSwr(workspaceId, isOpen)
    const save = useMutateSaveWebsiteSiteSwr(workspaceId ?? "")
    const site = read.data
    const agent = draft.agent ?? site?.agentId ?? ALL_OPTION
    const formUrl = site?.formUrl ?? ""
    const tab = draft.tab ?? "embed"
    return {
        view: {
            isOpen,
            isLoading: isOpen && site === undefined,
            isPending: save.isMutating,
            isEnabled: site?.isEnabled === true,
            tab,
            snippet: embedSnippetOf(formUrl),
            formUrl,
            chatOn: draft.chat ?? site?.chatEnabled ?? true,
            formOn: draft.form ?? site?.formEnabled ?? true,
            pricesOn: draft.prices ?? site?.pricesEnabled ?? false,
            agent,
            agents,
        },
        open: () => setOpen(true),
        close: () => {
            setOpen(false)
            setDraft({})
            setFailed(false)
        },
        selectTab: (id) => setDraft((current) => ({ ...current, tab: id })),
        setChat: (on) => setDraft((current) => ({ ...current, chat: on })),
        setForm: (on) => setDraft((current) => ({ ...current, form: on })),
        setPrices: (on) => setDraft((current) => ({ ...current, prices: on })),
        setAgent: (id) => setDraft((current) => ({ ...current, agent: id })),
        save: () => {
            setFailed(false)
            void save
                .trigger({
                    isEnabled: true,
                    chatEnabled: draft.chat ?? site?.chatEnabled ?? true,
                    formEnabled: draft.form ?? site?.formEnabled ?? true,
                    pricesEnabled: draft.prices ?? site?.pricesEnabled ?? false,
                    agentId: agent === ALL_OPTION ? null : agent,
                })
                .then(() => {
                    setOpen(false)
                    setDraft({})
                })
                .catch(() => setFailed(true))
        },
        failed,
        copy: async (text) => {
            try {
                await navigator.clipboard.writeText(text)
                return true
            } catch {
                return false
            }
        },
    }
}
