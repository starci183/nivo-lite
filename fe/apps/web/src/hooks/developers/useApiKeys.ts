"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import {
    useMutateCreateApiKeySwr,
    useMutateRenameApiKeySwr,
    useMutateRevokeApiKeySwr,
    useQueryAgentsSwr,
    useQueryApiKeysSwr,
} from "@/hooks/swr"
import { isManager, useMember } from "@/hooks/member"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { ApiKeyAgent, KeyKind, ApiKeyWire } from "./developers.shared"
import { useGraphQLWithToast } from "@/modules/toast"

/** What a created key answers: its secret (shown once), the address the API published for it and its kind. */
export interface CreatedKey {
    readonly secret: string
    readonly endpointUrl: string | null
    readonly kind: KeyKind
}

/** The view `useApiKeys` returns. */
export interface ApiKeysView {
    /** The keys the API answers an owner or manager: every key of the workspace. */
    items: ApiKeyWire[]
    /** The agents of the workspace a key may be scoped to. */
    agents: ApiKeyAgent[] | undefined
    isLoading: boolean
    loadFailed: boolean
    /** Creates a key of a kind; `agentId` scopes it to one agent, none means no agent. Answers the key once, or `undefined` when it failed. */
    create: (name: string, kind: KeyKind, agentId: string | undefined) => Promise<CreatedKey | undefined>
    isCreating: boolean
    rename: (keyId: string, name: string) => Promise<boolean>
    isRenaming: boolean
    revoke: (keyId: string) => Promise<boolean>
    isRevoking: boolean
}

/**
 * The API keys of the active workspace with their three writes. Each write toasts its outcome (a failure shows the server-localized
 * message) and refreshes the list on success. The agents come from the `agents` read, for the scope choice and the scope words of each row.
 */
export const useApiKeys = (): ApiKeysView => {
    const t = useTranslations("developers")
    const runGraphQL = useGraphQLWithToast()
    const workspaceId = useWorkspaceId()
    // Only an owner or manager reads the keys block; the API refuses anyone else, so a staff member asks for nothing.
    const mayRead = isManager(useMember())
    const keys = useQueryApiKeysSwr(mayRead ? workspaceId : undefined)
    const agents = useQueryAgentsSwr(mayRead ? {} : null)
    const creation = useMutateCreateApiKeySwr()
    const renaming = useMutateRenameApiKeySwr()
    const revocation = useMutateRevokeApiKeySwr()
    const { mutate } = keys
    const create = useCallback(
        async (name: string, kind: KeyKind, agentId: string | undefined): Promise<CreatedKey | undefined> => {
            const created = await runGraphQL(
                () => creation.trigger({ name, kind, ...(agentId === undefined ? {} : { agentId }) }),
                { successMessage: t("keyCreated") },
            )
            if (created === undefined) return undefined
            await mutate()
            return { secret: created.key, endpointUrl: created.item.endpointUrl, kind: created.item.kind }
        },
        [runGraphQL, creation, mutate, t],
    )
    const rename = useCallback(
        async (keyId: string, name: string): Promise<boolean> => {
            const renamed = await runGraphQL(() => renaming.trigger({ keyId, name }), {
                successMessage: t("keyRenamed"),
            })
            if (renamed === undefined) return false
            await mutate()
            return true
        },
        [runGraphQL, renaming, mutate, t],
    )
    const revoke = useCallback(
        async (keyId: string): Promise<boolean> => {
            const revoked = await runGraphQL(() => revocation.trigger({ keyId }), { successMessage: t("keyRevoked") })
            if (revoked === undefined) return false
            await mutate()
            return true
        },
        [runGraphQL, revocation, mutate, t],
    )
    return {
        items: keys.data ?? [],
        agents: agents.data?.map((agent) => ({ id: agent.id, name: agent.name })),
        isLoading: keys.isLoading || agents.isLoading,
        loadFailed: keys.error !== undefined,
        create,
        isCreating: creation.isMutating,
        rename,
        isRenaming: renaming.isMutating,
        revoke,
        isRevoking: revocation.isMutating,
    }
}
