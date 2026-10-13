import { useLocale } from "next-intl"
import { useCallback } from "react"
import { decodeCreatedWorkspace, request } from "@/modules/api"
import type { CreatedWorkspaceItem, Outcome } from "@/modules/api"
import { readBrowserAccessToken } from "@/modules/db/browser"

/** Creates a free workspace owned by the signed-in person through the back end api, sent with their token and the reader language. */
export const useCreateWorkspace = (): ((name: string) => Promise<Outcome<CreatedWorkspaceItem>>) => {
    const locale = useLocale()
    return useCallback(
        async (name) => {
            const token = await readBrowserAccessToken()
            if (token.kind !== "ok") return { kind: "refused", status: 401, fault: { code: token.code } }
            return request(
                { path: "/workspaces", method: "POST", token: token.value, locale, body: { name: name.trim() } },
                decodeCreatedWorkspace,
            )
        },
        [locale],
    )
}
