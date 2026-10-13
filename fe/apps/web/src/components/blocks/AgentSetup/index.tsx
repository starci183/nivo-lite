"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useSetupChat, useSetupGates, useSetupProgress, useSetupThread, useThreadScroll } from "@/hooks/modules"
import type { SetupWrite } from "@/lib/module-setup-writes"
import { applyDraft, changeGate, decideCard, postSetupMessage } from "@/lib/module-actions"
import { gateEntry, gateHint, gateLabel, gatesOf } from "@/modules/installations"
import type { ModuleKey } from "@/modules/catalog"
import type { ContextVersion, SetupMessage, SetupRevision, SetupSession } from "@/modules/installations"
import { navigation } from "@/modules/i18n"
import { AgentSetupBase } from "./component"

/** What the Setup page hands the block: what the server read, in the reader language where it is copy. */
type AgentSetupProps = {
    readonly moduleKey: ModuleKey
    /** Empty while the screen loads. */
    readonly installationId: string
    readonly activeVersionId: string | null
    /** The instance being set up, when its type allows several: a fact may be kept for this instance only. */
    readonly instance: { readonly name: string; readonly typeName: string } | null
    readonly session: SetupSession
    readonly messages: ReadonlyArray<SetupMessage>
    readonly writes: ReadonlyArray<SetupWrite>
    readonly revisions: ReadonlyArray<SetupRevision>
    readonly versions: ReadonlyArray<ContextVersion>
    /** Requirements of the module the workspace does not meet yet: a soft notice, never a block. */
    readonly unmet: ReadonlyArray<{ readonly label: string; readonly href: string }>
    readonly isLoading: boolean
}

const GATE_TONE = { missing: "neutral", proposed: "warning", confirmed: "success" } as const

/** The connected Setup tab: the private chat with NIVO, the draft, the gate checklist, the knowledge and the versions of one agent. */
export const AgentSetup = (props: AgentSetupProps) => {
    const t = useTranslations("moduleSetup")
    const locale = useLocale() === "en" ? "en" : "vi"
    const format = useFormatter()
    const router = navigation.useRouter()
    const chat = useSetupChat(
        { session: props.session, messages: props.messages, writes: props.writes },
        props.isLoading,
        { post: postSetupMessage, decide: decideCard },
    )
    const gatesState = useSetupGates(chat.session, chat.setSession, props.installationId, {
        change: changeGate,
        apply: applyDraft,
    })
    const active = props.versions.find((version) => version.id === props.activeVersionId) ?? null
    const progress = useSetupProgress(props.moduleKey, chat.session, active)
    const threadRef = useThreadScroll(`${chat.messages.length}:${chat.isSending}:${props.revisions.length}`)
    const groups = useSetupThread(props.revisions, chat.messages, chat.writes, props.versions, chat.session.id, {
        applied: (version, appliedAt, who) =>
            t("revisionApplied", {
                version,
                when: format.dateTime(new Date(appliedAt), { day: "2-digit", month: "2-digit", year: "numeric" }),
                who,
            }),
        appliedPlain: (version) => t("revisionAppliedPlain", { version }),
    })
    const first = props.unmet[0]
    return (
        <AgentSetupBase
            props={{
                isLoading: props.isLoading,
                chatTitle: t("chatTitle"),
                chatPrivate: t("chatPrivate"),
                emptyTitle: t("emptyTitle"),
                emptyBody: t("emptyBody"),
                groups: groups.map((group) => ({
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
                instance: props.instance,
                sendingLabel: t("sending"),
                isSending: chat.isSending,
                composerLabel: t("chatPlaceholder"),
                text: chat.text,
                sendLabel: t("send"),
                failureTitle: t("chatError"),
                failure: chat.failure,
                unmet:
                    first === undefined
                        ? null
                        : {
                              title: t("requirementsTitle"),
                              body: `${t("requirementsBody")} ${props.unmet.map((item) => item.label).join("; ")}.`,
                              actionLabel: t("requirementsFix"),
                              href: first.href,
                          },
                draft: {
                    title: t("draftTitle"),
                    summary: chat.session.draft.summary,
                    emptyText: t("draftEmpty"),
                    factsTitle: t("factsTitle"),
                    facts: chat.session.draft.facts,
                    isLoading: props.isLoading,
                },
                gates: {
                    title: t("gatesTitle"),
                    progressLabel: t("gatesProgress", { done: progress.confirmed, total: progress.total }),
                    confirmed: progress.confirmed,
                    total: progress.total,
                    gates: gatesOf(props.moduleKey).map((gate) => {
                        const entry = gateEntry(chat.session.gateEvidence, gate.key)
                        return {
                            key: gate.key,
                            label: gateLabel(gate, locale),
                            hint: gateHint(gate, locale),
                            status: entry.status,
                            statusLabel: t(`gate_${entry.status}`),
                            statusTone: GATE_TONE[entry.status],
                            evidence: entry.evidence,
                        }
                    }),
                    isLoading: props.isLoading,
                    editing: gatesState.editing,
                    editText: gatesState.editText,
                    evidencePlaceholder: t("evidencePlaceholder"),
                    isGating: gatesState.isGating,
                    gateFailureTitle: t("applyFailed"),
                    gateFailure: gatesState.gateFailure,
                    confirmLabel: t("confirm"),
                    unconfirmLabel: t("unconfirm"),
                    editLabel: t("edit"),
                    editSaveLabel: t("editSave"),
                    editCancelLabel: t("editCancel"),
                    applyLabel: gatesState.isApplying ? t("applying") : t("apply"),
                    isApplying: gatesState.isApplying,
                    canApply: progress.isReady && !progress.isUnchanged,
                    applyHint: progress.isReady && progress.isUnchanged ? t("applyUnchanged") : t("applyHint"),
                    applyTone: gatesState.applyNote.tone,
                    applyTitle: gatesState.applyNote.tone === "applied" ? t("apply") : t("applyFailed"),
                    applyText:
                        gatesState.applyNote.tone === "applied"
                            ? t("applied", { version: gatesState.applyNote.version })
                            : gatesState.applyNote.text,
                },
                knowledge: {
                    installationId: props.installationId,
                    moduleKey: props.moduleKey,
                    refreshKey: `${chat.session.revision}:${chat.session.draft.facts.length}:${props.versions.length}`,
                    isLoading: props.isLoading,
                },
                versions: {
                    title: t("versionsTitle"),
                    emptyText: t("versionsEmpty"),
                    inUseLabel: t("inUse"),
                    versions: props.versions.map((version) => ({
                        id: version.id,
                        line: t("versionLine", { version: version.version }),
                        detail: `${t("versionBy", {
                            who: version.appliedBy,
                            when: format.dateTime(new Date(version.appliedAt), {
                                dateStyle: "medium",
                                timeStyle: "short",
                            }),
                        })} · ${t("versionFacts", { count: version.snapshot.facts.length })}`,
                        isActive: version.id === props.activeVersionId,
                    })),
                    isLoading: props.isLoading,
                },
            }}
            on={{
                thread: (element) => {
                    threadRef.current = element
                },
                text: chat.setText,
                send: chat.send,
                decide: chat.decide,
                editText: gatesState.setEditText,
                gate: (key, action, evidence) => gatesState.gate(key, { action, evidence }),
                startEdit: gatesState.startEdit,
                stopEdit: gatesState.stopEdit,
                apply: gatesState.apply,
                open: (href) => router.push(href),
                refresh: () => router.refresh(),
            }}
        />
    )
}
