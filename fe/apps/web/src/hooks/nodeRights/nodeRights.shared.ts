import type { useQueryAgentNodeRightsSwr, useQueryProviderRightHoldersSwr } from "@/hooks/swr"
import type {
    AgentNodeRightsView,
    NodeRightMode,
    NodeRightOperationView,
    ProviderRightHoldersView,
    RightPlaceView,
} from "@/modules/types"

/** The wire of one agent's node rights and of one account's right holders. */
export type AgentNodeRightsWire = Exclude<ReturnType<typeof useQueryAgentNodeRightsSwr>["data"], undefined>
/** The wire of one account right holders list. */
export type ProviderRightHoldersWire = Exclude<ReturnType<typeof useQueryProviderRightHoldersSwr>["data"], undefined>
type OperationWire = AgentNodeRightsWire["rows"][number]["operation"]

/** The resolved shared vocabulary of the rights screens (namespace `nodeRights`). */
export interface NodeRightsWords {
    readonly kindRead: string
    readonly kindWrite: string
    readonly effects: Readonly<Record<string, string>>
    readonly modeAuto: string
    readonly modeAsk: string
    readonly modeInline: { readonly auto: string; readonly ask: string }
    readonly stepsUsing: (count: number) => string
    readonly noHolder: string
    readonly noStepCalls: string
    readonly notOpen: string
    readonly everyMember: string
    readonly roles: Readonly<Record<string, string>>
    /** The provider in words from the provider catalogue; the key itself when the catalogue does not know it. */
    readonly providerNameOf: (provider: string) => string
    readonly providerLogoOf: (provider: string) => string | null
    /** The label of a step from the step registry (as the canvas names it); the node key when the registry has no card for it. */
    readonly stepLabelOf: (step: string, nodeKey: string) => string
}

/** A wire mode as the screens' mode: anything but `auto` reads as asking first (the stricter). */
const modeOf = (mode: string): NodeRightMode => (mode === "auto" ? "auto" : "ask")

/** The registry's words in the reader's language; null when none is declared. */
const titleOf = (title: { readonly vi: string; readonly en: string } | null, locale: string): string | null => {
    if (title === null) return null
    return locale === "en" ? title.en : title.vi
}

/** The mode in words, inline. */
const modeWordOf = (mode: NodeRightMode, words: NodeRightsWords): string =>
    mode === "auto" ? words.modeInline.auto : words.modeInline.ask

/**
 * The one chip of a right: read for a read; for a write its display mark (the provider's money / irreversible, which never
 * changes a mode) or write, then the mode of the node that calls it (write with its mode). A read never asks.
 */
const chipOf = (operation: OperationWire, words: NodeRightsWords, mode: NodeRightMode | null): string => {
    const isWrite = operation.kind === "write"
    const head = (operation.effect === null ? undefined : words.effects[operation.effect]) ?? (isWrite ? words.kindWrite : words.kindRead)
    if (!isWrite || mode === null) return head
    return `${head} · ${modeWordOf(mode, words)}`
}

/** One operation as every rights screen names it; `mode` is the mode it is held in, when the row has one. */
export const operationViewOf = (
    operation: OperationWire,
    words: NodeRightsWords,
    locale: string,
    mode: NodeRightMode | null,
): NodeRightOperationView => ({
    id: operation.id,
    title: titleOf(operation.title, locale),
    endpoint: operation.method === null ? null : `${operation.method} ${operation.path ?? ""}`.trim(),
    isWrite: operation.kind === "write",
    effectLabel: operation.effect === null ? null : (words.effects[operation.effect] ?? null),
    chip: chipOf(operation, words, mode),
})

/** Where a right is used, with the address of its step when the agent's page is known. */
export type StepHrefOf = (agentId: string, workflowKey: string, nodeKey: string) => string | null

/** The holder of a right as the placing of its step reads it. */
interface PlaceHolder {
    readonly agentId: string
    readonly workflowKey: string
    readonly workflowName: string
    readonly nodeKey: string
    readonly step: string
    /** The server's title of the step; the blocks-core card title is the fallback, the key the last. */
    readonly stepTitle: { readonly vi: string; readonly en: string } | null
}

const placeOf = (
    holder: PlaceHolder,
    agentName: string | null,
    hrefOf: StepHrefOf,
    words: NodeRightsWords,
    locale: string,
): RightPlaceView => {
    const stepLabel = titleOf(holder.stepTitle, locale) ?? words.stepLabelOf(holder.step, holder.nodeKey)
    return {
        agentId: holder.agentId,
        agentName,
        workflowKey: holder.workflowKey,
        workflowName: holder.workflowName,
        nodeKey: holder.nodeKey,
        step: holder.step,
        stepLabel,
        line: `${holder.workflowName} › ${stepLabel}`,
        href: hrefOf(holder.agentId, holder.workflowKey, holder.nodeKey),
    }
}

/** One agent's node rights as the agent › rights page and the node panel read them. */
export const agentNodeRightsOf = (
    wire: AgentNodeRightsWire,
    words: NodeRightsWords,
    locale: string,
    hrefOf: StepHrefOf,
): AgentNodeRightsView => ({
    agentId: wire.agentId,
    accounts: wire.accounts.map((account) => ({
        connectionId: account.connectionId,
        provider: account.provider,
        providerName: words.providerNameOf(account.provider),
        logoSrc: words.providerLogoOf(account.provider),
        kind: account.kind,
        name: account.name,
        stepsUsing: account.stepsUsing,
        stepsLine: words.stepsUsing(account.stepsUsing),
        operations: account.operations.map((operation) => operationViewOf(operation, words, locale, null)),
    })),
    rows: wire.rows.map((row) => ({
        id: `${row.workflowId}:${row.nodeKey}:${row.connectionId}:${row.operation.id}`,
        connectionId: row.connectionId,
        operation: operationViewOf(row.operation, words, locale, modeOf(row.mode)),
        mode: modeOf(row.mode),
        place: placeOf({ ...row, agentId: wire.agentId }, null, hrefOf, words, locale),
    })),
})

/** The line a right with no holder shows: not open, or no step calls it; null when it has holders. */
const emptyLineOf = (
    tool: ProviderRightHoldersWire["tools"][number],
    words: NodeRightsWords,
): string | null => {
    if (!tool.open) return words.notOpen
    return tool.holders.length === 0 ? words.noStepCalls : null
}

/** Who holds each right of one account, as the provider › rights tab reads it. */
export const providerRightHoldersOf = (
    wire: ProviderRightHoldersWire,
    words: NodeRightsWords,
    locale: string,
    hrefOf: StepHrefOf,
): ProviderRightHoldersView => ({
    counts: wire.counts,
    tools: wire.tools.map((tool) => ({
        id: tool.operation.id,
        operation: operationViewOf(tool.operation, words, locale, null),
        isOpen: tool.open,
        holders: tool.holders.map((holder) => {
            const mode = modeOf(holder.mode)
            return {
                id: `${holder.workflowId}:${holder.nodeKey}`,
                mode,
                chip: `${holder.agentName} · ${modeWordOf(mode, words)}`,
                place: placeOf(holder, holder.agentName, hrefOf, words, locale),
            }
        }),
        emptyLine: emptyLineOf(tool, words),
    })),
    screens: wire.screens.map((screen) => ({
        id: screen.name,
        name: screen.name,
        summary: titleOf(screen.summary, locale),
        audience: words.everyMember,
    })),
    triggers: wire.triggers.map((trigger) => ({
        id: trigger.name,
        name: trigger.name,
        summary: titleOf(trigger.summary, locale) ?? trigger.name,
        holders: trigger.holders.map((holder) => ({
            id: `${holder.agentId}:${holder.workflowId ?? ""}:${holder.role}`,
            agentId: holder.agentId,
            chip: `${holder.agentName} · ${words.roles[holder.role] ?? holder.role}`,
            place:
                holder.workflowKey === null || holder.nodeKey === null
                    ? null
                    : placeOf(
                          {
                              agentId: holder.agentId,
                              workflowKey: holder.workflowKey,
                              workflowName: holder.workflowName ?? "",
                              nodeKey: holder.nodeKey,
                              step: holder.step ?? "",
                              stepTitle: holder.stepTitle ?? null,
                          },
                          holder.agentName,
                          hrefOf,
                          words,
                          locale,
                      ),
        })),
    })),
})
