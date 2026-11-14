"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { apiKeyRowOf, useApiKeyCreate, useApiKeyRename, useApiKeys } from "@/hooks/developers"
import { isManager, useMember } from "@/hooks/member"
import { ApiKeysSectionBase } from "./component"
import { NO_AGENT_SCOPE, drawerOf, freshOf, renameOf, rowWordsOf } from "./words"

/** Puts a snippet on the clipboard; a refusal is silent (the text stays on screen to select). */
const copyText = (code: string) => {
    navigator.clipboard.writeText(code).then(
        () => undefined,
        () => undefined,
    )
}

/** The connected keys: one list of MCP and public API keys, create (the secret is shown once), rename and revoke. Owner and manager only: staff see nothing of it and it asks the API for nothing. */
export const ApiKeysSection = () => {
    const t = useTranslations("developers")
    const isAllowed = isManager(useMember())
    const format = useFormatter()
    const keys = useApiKeys()
    const creation = useApiKeyCreate(keys.create)
    const renaming = useApiKeyRename(keys.items, keys.rename)
    const [revokingId, setRevokingId] = useState<string>()
    const revoking = keys.items.find((item) => item.id === revokingId)
    const confirmRevoke = async () => {
        if (revokingId === undefined) return
        await keys.revoke(revokingId)
        setRevokingId(undefined)
    }
    const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
    const words = rowWordsOf(t)
    if (!isAllowed) return null
    return (
        <ApiKeysSectionBase
            props={{
                title: t("keysTitle"),
                createLabel: t("create"),
                isLoading: keys.isLoading,
                loadError: keys.loadFailed ? { title: t("keysLoadFailed") } : undefined,
                emptyLabel: t("keysEmpty"),
                revokeLabel: t("revoke"),
                renameLabel: t("rename"),
                items: keys.items.map((item) => apiKeyRowOf(item, keys.agents, words, date)),
                drawer: drawerOf({
                    t,
                    isOpen: creation.isOpen,
                    name: creation.name,
                    kind: creation.kind,
                    scope: creation.agentId === "" ? NO_AGENT_SCOPE : creation.agentId,
                    agents: keys.agents,
                    isPending: keys.isCreating,
                    isValid: creation.isValid,
                }),
                fresh: creation.fresh.kind === "shown" ? freshOf(t, creation.fresh) : undefined,
                renaming:
                    renaming.key === undefined
                        ? undefined
                        : renameOf(t, renaming.key, {
                              name: renaming.name,
                              isPending: keys.isRenaming,
                              isValid: renaming.isValid,
                          }),
                revoking:
                    revoking === undefined
                        ? undefined
                        : {
                              title: t("revokeAsk", { name: revoking.name }),
                              confirmLabel: t("revokeConfirm"),
                              cancelLabel: t("cancel"),
                              isPending: keys.isRevoking,
                          },
            }}
            on={{
                openCreate: creation.open,
                closeCreate: creation.close,
                changeName: creation.setName,
                changeKind: creation.setKind,
                changeScope: (value) => creation.setAgent(value === NO_AGENT_SCOPE ? "" : value),
                submit: creation.submit,
                dismissFresh: creation.dismissFresh,
                copySnippet: copyText,
                askRename: renaming.ask,
                changeRename: renaming.setName,
                submitRename: renaming.submit,
                closeRename: renaming.close,
                askRevoke: setRevokingId,
                cancelRevoke: () => setRevokingId(undefined),
                confirmRevoke: () => void confirmRevoke(),
            }}
        />
    )
}
