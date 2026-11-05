"use client"

import { useMutateAuthorizeGoogleSwr } from "@/hooks/swr"
import type { AutomationStatus } from "@/modules/automations"
import { navigation } from "@/modules/i18n"
import { automationFocusPath } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import type { AutomationCardView } from "@/modules/types"
import { CONNECTION_ROUTE } from "./automations.shared"

/** Starts what a card still needs before its switch works: the page of the connection, or the Google sign-in that returns to the card. */
export const useAutomationConnect = (): ((card: AutomationCardView, status: AutomationStatus) => Promise<void>) => {
    const router = navigation.useRouter()
    const runGraphQL = useGraphQLWithToast()
    const authorize = useMutateAuthorizeGoogleSwr()
    return async (card, status) => {
        const route = CONNECTION_ROUTE[status]
        if (route !== undefined) {
            router.push(route)
            return
        }
        const started = await runGraphQL(() => authorize.trigger({ returnTo: automationFocusPath(card.key) }), {
            showSuccessToast: false,
        })
        if (started !== undefined) window.location.assign(started.url)
    }
}
