"use client"

import { useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { useMutateSetDefaultReceivingAccountSwr, useQueryProviderRightsSwr } from "@/hooks/swr"
import type { AccountWire, ProviderWire } from "@/modules/providerRights"

/** The ability a payment account needs to receive money by QR: only such an account can be the default. */
const RECEIVING_ABILITY = "qr.create"

/** A payment account that can receive, with its provider. */
interface ReceivingAccount {
    readonly provider: ProviderWire
    readonly account: AccountWire
}

/** The shop's default receiving account, the accounts it can be changed to, the picker state and the change (owner only). */
interface DefaultReceivingAccount {
    /** Only the owner sees and changes it; false while the role loads. */
    readonly isOwner: boolean
    readonly isLoading: boolean
    /** The default account; null when several can receive and none is chosen yet. */
    readonly current: ReceivingAccount | null
    /** Connected payment accounts whose provider can create a QR. */
    readonly candidates: ReadonlyArray<ReceivingAccount>
    readonly isPickerOpen: boolean
    readonly picked: string | null
    readonly isSaving: boolean
    readonly openPicker: () => void
    readonly closePicker: () => void
    readonly pick: (connectionId: string) => void
    /** `setDefaultReceivingAccount` with the picked account, then the board is read again. */
    readonly save: () => Promise<void>
}

/**
 * The "default receiving account" of the Connections page from `providerRights`: the payment account with `isDefaultReceiving`, and as
 * candidates every connected payment account whose provider has `qr.create`. The change is `setDefaultReceivingAccount` (owner only).
 */
export const useDefaultReceivingAccount = (): DefaultReceivingAccount => {
    const role = useConnectionsRole()
    const rights = useQueryProviderRightsSwr()
    const setMutation = useMutateSetDefaultReceivingAccountSwr()
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [picked, setPicked] = useState<string | null>(null)
    const candidates = (rights.data?.providers ?? [])
        .filter(
            (provider) =>
                provider.kind === "payment" && provider.abilities.some((ability) => ability.id === RECEIVING_ABILITY),
        )
        .flatMap((provider) =>
            provider.accounts.filter((account) => account.connected).map((account) => ({ provider, account })),
        )
    const current = candidates.find((one) => one.account.isDefaultReceiving) ?? null
    return {
        isOwner: role.role === "owner",
        isLoading: rights.isLoading,
        current,
        candidates,
        isPickerOpen,
        picked,
        isSaving: setMutation.isMutating,
        openPicker: () => {
            setPicked(current?.account.connectionId ?? null)
            setIsPickerOpen(true)
        },
        closePicker: () => setIsPickerOpen(false),
        pick: setPicked,
        save: async () => {
            if (picked === null || picked === current?.account.connectionId) {
                setIsPickerOpen(false)
                return
            }
            await setMutation.trigger({ connectionId: picked })
            await rights.mutate()
            setIsPickerOpen(false)
        },
    }
}
