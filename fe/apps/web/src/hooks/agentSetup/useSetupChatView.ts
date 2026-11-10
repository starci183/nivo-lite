"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { useSetupBrandCards } from "./useSetupBrandCards"
import type { useSetupChat } from "./useSetupChat"
import type { useSetupState } from "./useSetupState"
import { messagesCopyOf } from "@/hooks/teamChat"
import type { useSetupWriteWords } from "@/hooks/setupCards"
import { setupRowsOf, setupThreadOf } from "@/modules/setup-view"
import type { ContextVersion } from "@/modules/installations"
import type { AgentSetupChatContent, AgentSetupCopy, SetupSideGate, TeamChatMessagesCopy } from "@/modules/types"

/** How many of the next missing items the composer offers as starts of a message. */
const SUGGESTIONS = 3

/** What the attach control of the composer offers: the brand guideline PDF. */
const PDF = ".pdf,application/pdf"

/** The translator of the setup copy. */
type SetupCopy = ReturnType<typeof useTranslations<"moduleSetup">>

/** What the chat content is made of: the state of the setup, its versions, the typing, the gates and the brand flow. */
interface ChatInput {
    readonly state: Extract<ReturnType<typeof useSetupState>["slot"], { readonly items: unknown }>["items"] | undefined
    readonly versions: ReadonlyArray<ContextVersion>
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
const chatContentOf = (t: SetupCopy, input: ChatInput, thread: ReturnType<typeof setupRowsOf>): AgentSetupChatContent => {
    const { state, chat } = input
    const kit = input.brand.content
    return {
        emptyTitle: t("emptyTitle"),
        emptyBody: t("emptyBody"),
        rows: thread.rows,
        writes: thread.writes,
        latestReplyId: thread.latestReplyId,
        instance: state?.instance.isMulti === true ? { name: state.instance.name, typeName: input.typeName } : null,
        sendingLabel: t("sending"),
        isSending: chat.isSending,
        staleLabel: state?.turn === "stale" && !chat.isSending ? t("turnStale") : "",
        words: input.words,
        decidingId: chat.decidingId,
        proposals: proposalsOf(t, input.gates),
        suggestions: input.gates
            .filter((gate) => gate.status === "missing")
            .slice(0, SUGGESTIONS)
            .map((gate) => ({ id: gate.key, label: gate.label })),
        composer: {
            formLabel: t("chatTitle"),
            messageLabel: t("chatPlaceholder"),
            placeholder: t("chatPlaceholder"),
            sendLabel: t("send"),
            draft: chat.text,
            typing: null,
            file:
                kit === null
                    ? null
                    : { label: kit.attachLabel, removeLabel: kit.attachLabel, accept: PDF, name: null, canPick: !kit.isReading },
            isSending: chat.isSending,
            isLoading: false,
            canSend: !chat.isSending && chat.text.trim().length > 0,
            error: null,
            suggestions: [],
            reply: null,
        },
    }
}

/** The words of the panes that do not come from a slot. */
const copyOf = (t: SetupCopy): AgentSetupCopy => ({
    paneLabel: t("paneLabel"),
    checklistLabel: t("checklistLabel"),
    feedNote: t("feedNote"),
    chatLabel: t("chatLabel"),
    chatTitle: t("chatTitle"),
    sideTitle: t("sideTitle"),
    understandingTitle: t("understandingTitle"),
    groupLabels: { auto: t("groupAuto"), ask: t("groupAsk"), never: t("groupNever") },
    understandingEmpty: t("understandingEmpty"),
    versionNone: t("versionNone"),
    mapTitle: t("mapTitle"),
    mapNote: t("mapNote"),
    mapModeLabel: t("mapModeLabel"),
    mapOpen: t("mapOpen"),
    mapClose: t("mapClose"),
    chatSubtitle: "",
    nivoName: t("nivo"),
    versionsTitle: t("versionsTitle"),
    versionsEmpty: t("versionsEmpty"),
    inUseLabel: t("inUse"),
    mapEmptyTitle: t("mapEmptyTitle"),
    mapEmptyBody: t("mapEmptyBody"),
    proposalFrom: t("proposalFrom"),
    applyLabel: t("apply"),
    cancelLabel: t("editCancel"),
    proposedLabel: t("gate_proposed"),
    confirmedLabel: t("gate_confirmed"),
    proposalsLabel: t("proposalsLabel"),
    proposalsEmpty: t("proposalsEmpty"),
    confirmLabel: t("confirm"),
    proposalEditLabel: t("proposalEdit"),
    suggestionsLabel: t("suggestionsLabel"),
    askingLabel: t("gateAsking"),
})

/** The words, the shared-thread words and the content of the setup chat: its session as rows of the shared thread, every word resolved. */
export const useSetupChatView = (
    input: ChatInput,
): { readonly copy: AgentSetupCopy; readonly messagesCopy: TeamChatMessagesCopy; readonly content: AgentSetupChatContent } => {
    const t = useTranslations("moduleSetup")
    const chatWords = useTranslations("teamChat")
    const format = useFormatter()
    const { state } = input
    const groups = setupThreadOf(
        state?.revisions ?? [],
        state?.messages ?? [],
        state?.writes ?? [],
        input.versions,
        state?.session.id ?? "",
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
    const thread = setupRowsOf(groups, {
        you: t("you"),
        nivo: t("nivo"),
        timeOf: (iso) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" }),
    })
    return { copy: copyOf(t), messagesCopy: messagesCopyOf(chatWords), content: chatContentOf(t, input, thread) }
}

