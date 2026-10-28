"use client"

import { navigation } from "@/modules/i18n"
import { sepayConnectionHref } from "@/modules/routes"
import { SEPAY_TAB_IDS } from "./sepayConnection.shared"
import { useSepayConnection } from "./useSepayConnection"

/**
 * The open tab, kept in the url (`?tab=`) like the Zalo page. Without one named, a connection that never received a webhook opens on
 * Test and every other opens on Overview (Overview while the read is still in flight).
 */
export const useSepayTab = (connectionId: string, asked: string | undefined) => {
    const router = navigation.useRouter()
    const { slot } = useSepayConnection(connectionId)
    const named = SEPAY_TAB_IDS.find((id) => id === asked)
    const fallback: (typeof SEPAY_TAB_IDS)[number] = slot.items?.health.lastWebhookAt === null ? "test" : "overview"
    return {
        selected: named ?? fallback,
        select: (id: string) => router.replace(sepayConnectionHref(connectionId, id)),
    }
}
