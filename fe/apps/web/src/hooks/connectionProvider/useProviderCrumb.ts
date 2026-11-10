"use client"

import { useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { useWorkspaceId } from "@/hooks/workspaces"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { Provider } from "@/modules/types"
import { providerPageHref } from "./connectionProvider.shared"

/** The step of the trail that names a provider: its title, linking to the provider's own page. */
interface ProviderCrumb {
    readonly id: string
    readonly label: string
    readonly href: string
}

/**
 * The middle step of a connection page's trail: the provider's title linking to its own page.
 * Undefined while the provider is not known yet (a connection page still being read), so the trail then holds the two steps it can name.
 */
export const useProviderCrumb = (provider: Provider | undefined): ProviderCrumb | undefined => {
    const t = useTranslations("connections")
    const workspaceId = useWorkspaceId()
    if (provider === undefined) return undefined
    return {
        id: "provider",
        label: t(providerKey(provider, "title")),
        href: providerPageHref(workspaceHref(workspaceId, CONSOLE_ROUTES.connections), provider),
    }
}
