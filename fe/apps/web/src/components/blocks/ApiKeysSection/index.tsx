"use client"

import { useFormatter, useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { useState } from "react"
import { useApiKeys } from "@/hooks/developers"
import { useApiKeyForm } from "@/hooks/rhf"
import { ApiKeysSectionBase } from "./component"

/** The connected API keys card: lists, creates (the secret is shown once) and revokes keys through the back end GraphQL API. */
export const ApiKeysSection = () => {
    const t = useTranslations("developers")
    const member = useMember()
    const format = useFormatter()
    const { items, loadFailed, create, isCreating, revoke, isRevoking } = useApiKeys()
    const form = useApiKeyForm()
    const [fresh, setFresh] = useState<string>()
    const [revokingId, setRevokingId] = useState<string>()
    const name = form.watch("name")
    const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
    const revoking = items.find((item) => item.id === revokingId)

    const submit = form.handleSubmit(async (values) => {
        const key = await create(values.name)
        if (key === undefined) return
        setFresh(key)
        form.reset()
    })

    const confirmRevoke = async () => {
        if (revokingId === undefined) return
        await revoke(revokingId)
        setRevokingId(undefined)
    }

    if (!isManager(member)) return null
    return (
        <ApiKeysSectionBase
            props={{
                title: t("keysTitle"),
                body: t("keysBody"),
                nameLabel: t("keyName"),
                nameHint: t("keyNameHint"),
                nameValue: name,
                createLabel: t("create"),
                isCreating,
                isCreateDisabled: !form.formState.isValid,
                fresh:
                    fresh === undefined
                        ? undefined
                        : {
                              title: t("newKeyTitle"),
                              warning: t("newKeyWarn"),
                              value: fresh,
                              copyLabel: t("copy"),
                              copiedLabel: t("copied"),
                              doneLabel: t("newKeyDone"),
                          },
                loadError: loadFailed ? { title: t("keysLoadFailed") } : undefined,
                emptyLabel: items.length === 0 && !loadFailed ? t("keysEmpty") : undefined,
                revokeLabel: t("revoke"),
                items: items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    prefixText: t("prefix", { prefix: `${item.prefix}…` }),
                    datesText: `${t("created", { date: date(item.createdAt) })} · ${
                        item.lastUsedAt === null || item.lastUsedAt === undefined
                            ? t("neverUsed")
                            : t("lastUsed", { date: date(item.lastUsedAt) })
                    }`,
                    statusLabel: item.revokedAt === null || item.revokedAt === undefined ? t("active") : t("revoked"),
                    isRevoked: item.revokedAt !== null && item.revokedAt !== undefined,
                })),
                revoking:
                    revoking === undefined
                        ? undefined
                        : {
                              title: t("revokeAsk", { name: revoking.name }),
                              confirmLabel: t("revokeConfirm"),
                              cancelLabel: t("cancel"),
                              isPending: isRevoking,
                          },
            }}
            on={{
                changeName: (value) => form.setValue("name", value, { shouldValidate: true }),
                create: () => void submit(),
                dismissFresh: () => setFresh(undefined),
                askRevoke: setRevokingId,
                cancelRevoke: () => setRevokingId(undefined),
                confirmRevoke: () => void confirmRevoke(),
            }}
        />
    )
}
