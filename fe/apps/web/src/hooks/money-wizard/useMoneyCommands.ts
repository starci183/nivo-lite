"use client"

import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { wizardConnectionOf } from "@/hooks/connection-wire"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateSaveProviderKeysSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveProviderKeysSwr"
import { useMutateStartMoneyConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateStartMoneyConnectionSwr"
import { useMutateUpdateMoneyConnectionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateUpdateMoneyConnectionSwr"
import type { MutateSaveProviderKeysRequest } from "@/modules/api/graphql/mutations/mutation-save-provider-keys"
import type { MoneyProvider, ProviderKeysResult, WizardConnection } from "@/modules/types"
import type { AccountForm } from "./money-wizard.shared"

/** The GraphQL commands of the bank and payment wizard (the active workspace travels in the request header). */
export interface MoneyCommands {
    readonly start: (provider: MoneyProvider, form: AccountForm) => Promise<Settled<WizardConnection>>
    readonly update: (
        connectionId: string,
        form: AccountForm,
        apiKey: string | undefined,
    ) => Promise<Settled<WizardConnection>>
    readonly saveKeys: (
        connectionId: string,
        values: Readonly<Record<string, string>>,
    ) => Promise<Settled<ProviderKeysResult>>
}

/** The fields of an account form as the back end names them. */
const accountBody = (form: AccountForm) => ({
    environment: form.environment,
    name: form.name,
    bankCode: form.bank,
    accountNumber: form.account,
    holder: form.holder,
})

/** The keys the owner pasted, limited to the ones the back end takes. */
const keysOf = (values: Readonly<Record<string, string>>): MutateSaveProviderKeysRequest["values"] => ({
    apiKey: values.apiKey,
    checksumKey: values.checksumKey,
    clientId: values.clientId,
    secureKey: values.secureKey,
})

/** The bank and payment wizard's mutations bound to the toast helper. */
export const useMoneyCommands = (): MoneyCommands => {
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerStart } = useMutateStartMoneyConnectionSwr()
    const { trigger: triggerUpdate } = useMutateUpdateMoneyConnectionSwr()
    const { trigger: triggerKeys } = useMutateSaveProviderKeysSwr()
    return useMemo(
        () => ({
            start: async (provider, form) => {
                const settled = await settle(() => triggerStart({ provider, ...accountBody(form) }))
                if (settled.kind !== "ok") return settled
                await refresh()
                return { kind: "ok", value: wizardConnectionOf(settled.value) }
            },
            update: async (connectionId, form, apiKey) => {
                const settled = await settle(() =>
                    triggerUpdate({ connectionId, ...accountBody(form), ...(apiKey === undefined ? {} : { apiKey }) }),
                )
                if (settled.kind !== "ok") return settled
                await refresh()
                return { kind: "ok", value: wizardConnectionOf(settled.value) }
            },
            saveKeys: async (connectionId, values) => {
                const settled = await settle(() => triggerKeys({ connectionId, values: keysOf(values) }))
                return settled.kind === "ok"
                    ? { kind: "ok", value: { confirmed: settled.value.confirmed, localOnly: settled.value.localOnly } }
                    : settled
            },
        }),
        [settle, refresh, triggerStart, triggerUpdate, triggerKeys],
    )
}
