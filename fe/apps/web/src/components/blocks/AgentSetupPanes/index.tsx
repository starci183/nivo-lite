"use client"

import { useTranslations } from "next-intl"
import { useAgentRights } from "@/hooks/agentSettings"
import { useAgentGraphPanel } from "@/hooks/agentGraph"
import {
    useSetupBrandCards,
    useSetupChat,
    useSetupState,
    useStaffSetupRedirect,
    useSetupVersions,
    useThreadScroll,
    useSetupChatView,
    startOf,
} from "@/hooks/agentSetup"
import { useModuleName, type ModuleKey } from "@/hooks/installations"
import { useSetupSide } from "@/hooks/setupSide"
import { useSetupWriteWords } from "@/hooks/setupCards"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useSetupWorkflowSteps } from "@/hooks/workflowSteps"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { SetupSideGate } from "@/modules/types"
import { AgentSetupPanesBase } from "./component"

/** What the Setup page hands the panes: the instance and catalogue key of the url. */
type AgentSetupPanesProps = {
    readonly installationId: string
    readonly module: ModuleKey
}

const NO_VERSIONS: ReadonlyArray<never> = []
const NO_GATES: ReadonlyArray<SetupSideGate> = []

/**
 * The connected Setup tab: the checklist of the eight items (progress, confirm, edit, run) and the private chat with NIVO that
 * fills them. The owner writes, NIVO answers in the background; its proposed items stand under its latest reply.
 */
export const AgentSetupPanes = (props: AgentSetupPanesProps) => {
    const access = useTranslations("access")
    const typeName = useModuleName(props.module, "shortName")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const words = useSetupWriteWords()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useSetupState(props.installationId)
    const side = useSetupSide(props.module, props.installationId)
    const graph = useAgentGraphPanel(props.installationId, side.setup)
    const steps = useSetupWorkflowSteps(props.installationId, graph.on.retryGraph)
    const versionsSlot = useSetupVersions(props.installationId)
    const versions = ("items" in versionsSlot ? versionsSlot.items : undefined)?.versions ?? NO_VERSIONS
    const state = "items" in slot ? slot.items : undefined
    const sessionId = state?.session.id ?? ""
    const chat = useSetupChat(sessionId, state?.turnPending === true)
    const brand = useSetupBrandCards(props.installationId, sessionId, props.module === "content" && canEdit, reload)
    const threadRef = useThreadScroll(
        `${state?.messages.length ?? 0}:${chat.isSending}:${state?.revisions.length ?? 0}:${brand.scrollKey}`,
    )
    useStaffSetupRedirect(props.module, props.installationId)
    const gates = ("items" in side.slot ? side.slot.items : undefined)?.gates.gates ?? NO_GATES
    const { copy, messagesCopy, content } = useSetupChatView({ state, versions, chat, gates, words, typeName, brand })
    const kit = brand.content
    const isGreeting = content.rows.length === 0 && (kit?.cards.length ?? 0) === 0
    return (
        <AgentSetupPanesBase
            props={{
                copy,
                messagesCopy,
                chat: mapSlot(slot, () => content),
                thread: "items" in slot && isGreeting ? { isEmpty: true } : mapSlot(slot, () => content),
                chatPlaceholder: content,
                brandKits: kit === null ? null : { isReading: kit.isReading, readingLabel: kit.readingLabel, cards: kit.cards },
                side: side.slot,
                sidePlaceholder: side.placeholder,
                ...graph.props,
                slotLabels: slotLabels(content.emptyTitle),
                forbidden: canEdit ? "" : access("forbidden"),
                threadRef,
                steps: { map: steps.map, selectedId: steps.selectedId, drawer: steps.drawer },
            }}
            on={{
                text: chat.setText,
                send: () => void chat.send(),
                suggest: (id) => {
                    const gate = gates.find((entry) => entry.key === id)
                    if (gate !== undefined) chat.setText(startOf(chat.text, gate.label))
                },
                decide: (id, change) => void chat.decide(id, change),
                ...brand.on,
                ...side.on,
                open: (href) => router.push(href),
                grants: () => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.authority)),
                retryChat: reload,
                retrySide: side.reload,
                ...graph.on,
                step: steps.act,
            }}
        />
    )
}
