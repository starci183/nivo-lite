"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeApiKeyRevocation, writeApiKeys } from "@/modules/db/developers/write-api-keys"
import { navigation } from "@/modules/i18n"
import { ApiKeysSectionBase } from "./component"

const { useRouter } = navigation

/** One API key as the page hands it over; never the secret. */
interface ApiKeyItem {
    readonly id: string
    readonly name: string
    readonly prefix: string
    readonly createdAt: string
    readonly lastUsedAt: string | null
    readonly revokedAt: string | null
}

/** Props for the connected API keys card. */
interface ApiKeysSectionProps {
    readonly workspaceId: string
    readonly items: ReadonlyArray<ApiKeyItem>
    /** True when the keys could not be read: the region fails in place. */
    readonly loadFailed: boolean
}

/** The connected API keys card: creates a key (shown once) and revokes one through Server Actions, then refreshes the page data. */
export const ApiKeysSection = (props: ApiKeysSectionProps) => {
    const t = useTranslations("developers")
    const format = useFormatter()
    const router = useRouter()
    const [name, setName] = useState("")
    const [fresh, setFresh] = useState<string>()
    const [createError, setCreateError] = useState<string>()
    const [revokeError, setRevokeError] = useState<string>()
    const [revokingId, setRevokingId] = useState<string>()
    const [isPending, startTransition] = useTransition()
    const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
    const revoking = props.items.find((item) => item.id === revokingId)
    const failure = (kind: string, fallback: string) => (kind === "refused" ? t("keysRefused") : fallback)

    const create = () =>
        startTransition(async () => {
            setCreateError(undefined)
            const created = await writeApiKeys({ workspaceId: props.workspaceId, name })
            if (created.kind !== "ok") return setCreateError(failure(created.kind, t("createFailed")))
            setFresh(created.value.key)
            setName("")
            router.refresh()
        })

    const revoke = () =>
        startTransition(async () => {
            if (revokingId === undefined) return
            setRevokeError(undefined)
            const revoked = await writeApiKeyRevocation({ workspaceId: props.workspaceId, keyId: revokingId })
            setRevokingId(undefined)
            if (revoked.kind !== "ok") return setRevokeError(failure(revoked.kind, t("revokeFailed")))
            router.refresh()
        })

    return (
        <ApiKeysSectionBase
            props={{
                title: t("keysTitle"),
                body: t("keysBody"),
                nameLabel: t("keyName"),
                nameHint: t("keyNameHint"),
                nameValue: name,
                createLabel: t("create"),
                isCreating: isPending && revokingId === undefined,
                isCreateDisabled: name.trim().length < 2,
                createError,
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
                loadError: props.loadFailed ? { title: t("keysLoadFailed") } : undefined,
                emptyLabel: props.items.length === 0 && !props.loadFailed ? t("keysEmpty") : undefined,
                revokeLabel: t("revoke"),
                revokeError,
                items: props.items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    prefixText: t("prefix", { prefix: `${item.prefix}…` }),
                    datesText: `${t("created", { date: date(item.createdAt) })} · ${
                        item.lastUsedAt === null ? t("neverUsed") : t("lastUsed", { date: date(item.lastUsedAt) })
                    }`,
                    statusLabel: item.revokedAt === null ? t("active") : t("revoked"),
                    isRevoked: item.revokedAt !== null,
                })),
                revoking:
                    revoking === undefined
                        ? undefined
                        : {
                              title: t("revokeAsk", { name: revoking.name }),
                              confirmLabel: t("revokeConfirm"),
                              cancelLabel: t("cancel"),
                              isPending,
                          },
            }}
            on={{
                changeName: setName,
                create,
                dismissFresh: () => setFresh(undefined),
                askRevoke: setRevokingId,
                cancelRevoke: () => setRevokingId(undefined),
                confirmRevoke: revoke,
            }}
        />
    )
}
