"use client"

import { useFormatter, useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { useState } from "react"
import { useApiKeys } from "@/hooks/developers"
import { useApiKeyForm } from "@/hooks/rhf"
import { ApiKeysSectionBase } from "./component"

/** The connected API keys card: lists, creates (the secret is shown once) and revokes keys through the back end GraphQL API. */
/** Connects the state and commands used by ApiKeysSection. */
/** Inputs for the connected state mapping. */
interface BuildApiKeysSectionStateInput {
    readonly form: ReturnType<typeof useApiKeyForm>
    readonly format: ReturnType<typeof useFormatter>
    readonly items: ReturnType<typeof useApiKeys>["items"]
    readonly revokingId: string | undefined
    readonly create: ReturnType<typeof useApiKeys>["create"]
    readonly setFresh: import("react").Dispatch<import("react").SetStateAction<string | undefined>>
    readonly revoke: ReturnType<typeof useApiKeys>["revoke"]
    readonly setRevokingId: import("react").Dispatch<import("react").SetStateAction<string | undefined>>
    readonly member: ReturnType<typeof useMember>
    readonly t: ReturnType<typeof useTranslations<"developers">>
    readonly isCreating: ReturnType<typeof useApiKeys>["isCreating"]
    readonly fresh: string | undefined
    readonly loadFailed: ReturnType<typeof useApiKeys>["loadFailed"]
    readonly isRevoking: ReturnType<typeof useApiKeys>["isRevoking"]
}

/** Derives display values and interactions from the supplied state. */
const buildApiKeysSectionState = ({
    form,
    format,
    items,
    revokingId,
    create,
    setFresh,
    revoke,
    setRevokingId,
    member,
    t,
    isCreating,
    fresh,
    loadFailed,
    isRevoking,
}: BuildApiKeysSectionStateInput) => {
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
    return {
        form,
        submit,
        setFresh,
        setRevokingId,
        confirmRevoke,
        t,
        name,
        isCreating,
        fresh,
        loadFailed,
        items,
        date,
        revoking,
        isRevoking,
    }
}

/** Draws the connected view from its current state. */
export const ApiKeysSection = () => {
    const t = useTranslations("developers")
    const member = useMember()
    const format = useFormatter()
    const { items, loadFailed, create, isCreating, revoke, isRevoking } = useApiKeys()
    const form = useApiKeyForm()
    const [fresh, setFresh] = useState<string>()
    const [revokingId, setRevokingId] = useState<string>()

    const connected = buildApiKeysSectionState({
        form,
        format,
        items,
        revokingId,
        create,
        setFresh,
        revoke,
        setRevokingId,
        member,
        t,
        isCreating,
        fresh,
        loadFailed,
        isRevoking,
    })
    if (connected === null) return null
    const { submit, confirmRevoke } = connected
    return (
        <ApiKeysSectionBase
            props={apiKeysSectionProps(connected)}
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

/** Builds the props supplied to ApiKeysSectionBase. */
const apiKeysSectionProps = (
    connected: NonNullable<ReturnType<typeof buildApiKeysSectionState>>,
): Parameters<typeof ApiKeysSectionBase>[0]["props"] => {
    const { t, name, isCreating, form, fresh, loadFailed, items, date, revoking, isRevoking } = connected
    return {
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
    }
}
