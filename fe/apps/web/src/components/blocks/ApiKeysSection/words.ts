import type { useTranslations } from "next-intl"
import { claudeCodeSnippetOf, type ApiKeyAgent, type ApiKeyWords, type FreshKeyState } from "@/hooks/developers"
import type { CreateKeyDrawerView, RenameKeyDrawerView } from "./drawers"
import type { FreshKeyView } from "./FreshKeyDialog"

/** The scope choice that names no agent. */
export const NO_AGENT_SCOPE = "none"

/** The words of the `developers` catalog. */
export type DevelopersWords = ReturnType<typeof useTranslations<"developers">>

/** The words a key row is made of, from the catalog. */
export const rowWordsOf = (t: DevelopersWords): ApiKeyWords => ({
    kindMcp: t("kindMcp"),
    kindPublicApi: t("kindPublicApi"),
    scopeMcpWorkspace: t("scopeMcpWorkspace"),
    scopeMcpAgent: (name) => t("scopeMcpAgent", { name }),
    scopeMcpAgentUnnamed: t("scopeMcpAgentUnnamed"),
    scopeApiDefault: t("scopeApiDefault"),
    scopeApiAgent: (name) => t("scopeApiAgent", { name }),
    scopeApiAgentUnnamed: t("scopeApiAgentUnnamed"),
    holder: (name) => t("holder", { name }),
    prefix: t("prefix"),
    created: (date) => t("created", { date }),
    lastUsed: (date) => t("lastUsed", { date }),
    neverUsed: t("neverUsed"),
    active: t("active"),
    revoked: t("revoked"),
    inactiveHolderNotManager: t("inactiveHolderNotManager"),
    inactiveHolderGone: t("inactiveHolderGone"),
})

/** What the create drawer reads from the form and the agents. */
export interface DrawerInput {
    readonly t: DevelopersWords
    readonly isOpen: boolean
    readonly name: string
    readonly kind: "mcp" | "public_api"
    readonly scope: string
    readonly agents: ReadonlyArray<ApiKeyAgent> | undefined
    readonly isPending: boolean
    readonly isValid: boolean
}

/** The scope choices of the drawer for a kind: no agent first, then the agents. */
const scopeItemsOf = (input: DrawerInput): CreateKeyDrawerView["scopeItems"] => {
    const isMcp = input.kind === "mcp"
    return [
        { id: NO_AGENT_SCOPE, title: isMcp ? input.t("scopeMcpMine") : input.t("scopeApiDefault") },
        ...(input.agents ?? []).map((agent) => ({
            id: agent.id,
            title: agent.name,
            subtitle: isMcp ? input.t("scopeMcpAgentHint") : input.t("scopeApiAgentHint"),
        })),
    ]
}

/** The create drawer in words: the name, the kind, and the scope choices of that kind. */
export const drawerOf = (input: DrawerInput): CreateKeyDrawerView => ({
    isOpen: input.isOpen,
    title: input.t("createTitle"),
    description: input.t("createBody"),
    closeLabel: input.t("close"),
    cancelLabel: input.t("cancel"),
    submitLabel: input.t("create"),
    nameLabel: input.t("keyName"),
    nameHint: input.t("keyNameHint"),
    nameValue: input.name,
    kindLabel: input.t("kindLabel"),
    kindItems: [
        { id: "mcp", title: input.t("kindMcp"), subtitle: input.t("kindMcpHint") },
        { id: "public_api", title: input.t("kindPublicApi"), subtitle: input.t("kindPublicApiHint") },
    ],
    kindValue: input.kind,
    scopeLabel: input.kind === "mcp" ? input.t("scopeLabel") : input.t("scopeApiLabel"),
    scopeItems: scopeItemsOf(input),
    scopeValue: input.scope,
    isPending: input.isPending,
    isSubmitDisabled: !input.isValid,
})

/** The part of the shown-once dialog that depends on the kind: an MCP key gets the command (or a neutral line when the API published no address); a public key gets none. */
const snippetPartOf = (t: DevelopersWords, fresh: Extract<FreshKeyState, { kind: "shown" }>): Partial<FreshKeyView> => {
    if (fresh.keyKind !== "mcp") return {}
    if (fresh.endpointUrl === null) return { snippetNote: t("claudeAddressUnset") }
    return {
        snippet: {
            title: t("claudeCodeTitle"),
            code: claudeCodeSnippetOf(fresh.endpointUrl, fresh.secret),
            copyLabel: t("copy"),
        },
    }
}

/** The shown-once dialog in words. */
export const freshOf = (t: DevelopersWords, fresh: Extract<FreshKeyState, { kind: "shown" }>): FreshKeyView => ({
    title: t("newKeyTitle"),
    closeLabel: t("close"),
    warning: t("newKeyWarn"),
    keyLabel: t("newKeyLabel"),
    value: fresh.secret,
    copyLabel: t("copy"),
    copiedLabel: t("copied"),
    doneLabel: t("newKeyDone"),
    ...snippetPartOf(t, fresh),
})

/** The key being renamed. */
interface RenamedKey {
    readonly name: string
}

/** The rename form's state. */
interface RenameState {
    readonly name: string
    readonly isPending: boolean
    readonly isValid: boolean
}

/** The rename drawer in words. */
export const renameOf = (t: DevelopersWords, key: RenamedKey, state: RenameState): RenameKeyDrawerView => ({
    title: t("renameTitle", { name: key.name }),
    closeLabel: t("close"),
    cancelLabel: t("cancel"),
    submitLabel: t("renameConfirm"),
    nameLabel: t("keyName"),
    nameHint: t("keyNameHint"),
    nameValue: state.name,
    isPending: state.isPending,
    isSubmitDisabled: !state.isValid,
})
