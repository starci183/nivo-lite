"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useAgentRights } from "@/hooks/agentSettings"
import { useAgentGraphPanel } from "@/hooks/agentGraph"
import {
    useSetupBrandCards,
    useSetupChat,
    useSetupState,
    useSetupVersions,
    useThreadScroll,
    setupThreadOf,
} from "@/hooks/agentSetup"
import { useModuleName, type ModuleKey } from "@/hooks/installations"
import { useSetupSide } from "@/hooks/setupSide"
import { useSetupWriteWords } from "@/hooks/setupCards"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import type { SetupSideGate } from "@/modules/types"
import { AgentSetupPanesBase } from "./component"
import type { AgentSetupChatContent, AgentSetupCopy } from "./component"

/** What the Setup page hands the panes: the instance and catalogue key of the url. */
type AgentSetupPanesProps = {
    readonly installationId: string
    readonly module: ModuleKey
}

const NO_VERSIONS: ReadonlyArray<never> = []
const NO_GATES: ReadonlyArray<SetupSideGate> = []

/** How many of the next missing items the composer offers as starts of a message. */
const SUGGESTIONS = 3

/** The translator of the setup copy. */
type SetupCopy = ReturnType<typeof useTranslations<"moduleSetup">>

/** What the chat content is made of: the state of the setup, the thread, the typing, the gates and the brand flow. */
interface ChatInput {
    readonly t: SetupCopy
    readonly state: ReturnType<typeof useSetupState>["slot"]["items"]
    readonly groups: ReturnType<typeof setupThreadOf>
    readonly chat: ReturnType<typeof useSetupChat>
    readonly gates: ReadonlyArray<SetupSideGate>
    readonly words: ReturnType<typeof useSetupWriteWords>
    readonly typeName: string
    readonly brand: ReturnType<typeof useSetupBrandCards>
}

/** The proposals of NIVO (items it filled and the owner did not confirm) in the words of the chat. */
const proposalsOf = (t: SetupCopy, gates: ReadonlyArray<SetupSideGate>): AgentSetupChatContent["proposals"] =>
    gates.flatMap((gate, index) =>
        gate.status === "proposed" && gate.evidence !== ""
            ? [
                  {
                      key: gate.key,
                      title: t("proposalTitle", { position: index + 1, label: gate.label }),
                      evidence: gate.evidence,
                  },
              ]
            : [],
    )

/** What the thread and the composer draw, every word resolved. */
const chatContentOf = (input: ChatInput): AgentSetupChatContent => {
    const { t, state, chat } = input
    const kit = input.brand.content
    return {
        emptyTitle: t("emptyTitle"),
        emptyBody: t("emptyBody"),
        hasMessages: input.groups.some((group) => group.messages.length > 0),
        groups: input.groups.map((group) => ({
            id: group.id,
            divider: group.divider,
            messages: group.messages.map(({ message, cards }) => ({
                id: message.id,
                isOwner: message.role === "user",
                author: message.role === "user" ? message.author || t("you") : t("nivo"),
                body: message.body,
                cards,
            })),
        })),
        instance: state?.instance.isMulti === true ? { name: state.instance.name, typeName: input.typeName } : null,
        sendingLabel: t("sending"),
        isSending: chat.isSending,
        staleLabel: state?.turn === "stale" && !chat.isSending ? t("turnStale") : "",
        composerLabel: t("chatPlaceholder"),
        composerHint: t("composerHint", { count: chat.text.length }),
        text: chat.text,
        sendLabel: t("send"),
        words: input.words,
        decidingId: chat.decidingId,
        proposals: proposalsOf(t, input.gates),
        suggestions: input.gates
            .filter((gate) => gate.status === "missing")
            .slice(0, SUGGESTIONS)
            .map((gate) => ({ id: gate.key, label: gate.label })),
        brandKits: kit === null ? null : { isReading: kit.isReading, readingLabel: kit.readingLabel, cards: kit.cards },
        attach: kit === null ? null : { label: kit.attachLabel, prompt: kit.attachPrompt, isReading: kit.isReading },
    }
}

/** The words of the panes that do not come from a slot. */
const copyOf = (t: SetupCopy): AgentSetupCopy => ({
    paneLabel: t("paneLabel"),
    checklistLabel: t("checklistLabel"),
    chatLabel: t("chatLabel"),
    chatTitle: t("chatTitle"),
    proposalsLabel: t("proposalsLabel"),
    confirmLabel: t("confirm"),
    proposalEditLabel: t("proposalEdit"),
    suggestionsLabel: t("suggestionsLabel"),
    askingLabel: t("gateAsking"),
})

/**
 * The connected Setup tab: the checklist of the eight items (progress, confirm, edit, run) and the private chat with NIVO that
 * fills them. The owner writes, NIVO answers in the background; its proposed items stand under its latest reply.
 */
export const AgentSetupPanes = (props: AgentSetupPanesProps) => {
    const t = useTranslations("moduleSetup")
    const access = useTranslations("access")
    const typeName = useModuleName(props.module, "shortName")
    const format = useFormatter()
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const words = useSetupWriteWords()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useSetupState(props.installationId)
    const side = useSetupSide(props.module, props.installationId)
    const graph = useAgentGraphPanel(props.installationId)
    const versions = useSetupVersions(props.installationId).items?.versions ?? NO_VERSIONS
    const state = slot.items
    const sessionId = state?.session.id ?? ""
    const chat = useSetupChat(sessionId, state?.turnPending === true)
    const brand = useSetupBrandCards(props.installationId, sessionId, props.module === "content" && canEdit, reload)
    const threadRef = useThreadScroll(
        `${state?.messages.length ?? 0}:${chat.isSending}:${state?.revisions.length ?? 0}:${brand.scrollKey}`,
    )
    const groups = setupThreadOf(
        state?.revisions ?? NO_VERSIONS,
        state?.messages ?? NO_VERSIONS,
        state?.writes ?? NO_VERSIONS,
        versions,
        sessionId,
        {
            applied: (version, appliedAt, who) =>
                t("revisionApplied", {
                    version,
                    when: format.dateTime(new Date(appliedAt), { day: "2-digit", month: "2-digit", year: "numeric" }),
                    who,
                }),
            appliedPlain: (version) => t("revisionAppliedPlain", { version }),
        },
    )
    const gates = side.slot.items?.gates.gates ?? NO_GATES
    const content = chatContentOf({ t, state, groups, chat, gates, words, typeName, brand })
    return (
        <AgentSetupPanesBase
            props={{
                copy: copyOf(t),
                chat: mapSlot(slot, () => content),
                chatPlaceholder: content,
                side: side.slot,
                sidePlaceholder: side.placeholder,
                ...graph.props,
                slotLabels: slotLabels(t("emptyTitle")),
                forbidden: canEdit ? "" : access("forbidden"),
                threadRef,
            }}
            on={{
                text: chat.setText,
                send: () => void chat.send(),
                suggest: (id) => {
                    const gate = gates.find((entry) => entry.key === id)
                    if (gate !== undefined) chat.setText(`${gate.label}: `)
                },
                decide: (id, change) => void chat.decide(id, change),
                ...brand.on,
                ...side.on,
                open: (href) => router.push(href),
                retryChat: reload,
                retrySide: side.reload,
                ...graph.on,
            }}
        />
    )
}
