"use client"

import { type SlotRead, useSlotLabels, slotOfReads } from "@/hooks/slot"

import { useFormatter, useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf, useWizardPhases } from "@/hooks/connection-wizard"
import type { AgentOption, SlotLabels, WizardPhases } from "@/modules/types"
import {
    IMAP_EVERY,
    IMAP_GUIDE_KEY,
    IMAP_PRESET_KEY,
    IMAP_PRESETS,
    IMAP_SINCE_DAYS,
    IMAP_SINCE_KEY,
    IMAP_STEPS,
    useImapWizard,
    useImapCopy,
} from "@/hooks/imap-wizard"
import { ImapWizardBase } from "./component"

/** What the board hands the mailbox wizard. */
interface ImapWizardProps {
    /** The actual workspace reads shared with this selected wizard. */
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    /** Workspace agents (any module): every agent may be bound to the mailbox. */
    readonly agents: ReadonlyArray<AgentOption>
    /** Continue or edit this existing mailbox instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Inputs needed to build the ImapWizardContent section. */
interface BuildMailboxAccountViewContext {
    readonly copy: ReturnType<typeof useImapCopy>
    readonly values: ReturnType<typeof useImapWizard>["values"]
    readonly savedId: ReturnType<typeof useImapWizard>["savedId"]
    readonly preset: ReturnType<typeof useImapWizard>["preset"]
    readonly t: ReturnType<typeof useTranslations<"connectorImap">>
    readonly isCustom: boolean
    readonly isPending: ReturnType<typeof useImapWizard>["isPending"]
    readonly wizard: ReturnType<typeof useImapWizard>
    readonly format: ReturnType<typeof useFormatter>
}

/** Inputs needed to build the whole view: the account inputs plus the page copy and the board props. */
interface BuildImapWizardViewContext extends BuildMailboxAccountViewContext {
    readonly tc: ReturnType<typeof useTranslations<"connections">>
    readonly tw: ReturnType<typeof useTranslations<"connectionWizard">>
    readonly props: ImapWizardProps
    readonly slotLabelsOf: (empty: string) => SlotLabels
    readonly phases: WizardPhases
}

/**
 * The mailbox (IMAP, read only) wizard, owner only: reads the saved mailbox when resuming, then sign in with a test that lists the
 * folders, folders and how far back the first sync reads, how often to sync (the mailbox is saved here), attach agents. A blank
 * password on an existing mailbox keeps the saved one.
 */
export const ImapWizard = (props: ImapWizardProps) => {
    const t = useTranslations("connectorImap")
    const tw = useTranslations("connectionWizard")
    const phases = useWizardPhases("imap")
    const tc = useTranslations("connections")
    const format = useFormatter()
    const slotLabelsOf = useSlotLabels()
    const wizard = useImapWizard({ resumeId: props.resumeId, onClose: props.onClose })
    const copy = useImapCopy(wizard.isPending)
    const { values, preset, savedId, isPending } = wizard
    const isCustom = preset === "other"
    const context = {
        copy,
        wizard,
        t,
        tc,
        tw,
        values,
        savedId,
        preset,
        isCustom,
        isPending,
        format,
        props,
        slotLabelsOf,
        phases,
    }
    return (
        <ImapWizardBase
            props={buildImapWizardView(context)}
            on={{
                go: wizard.go,
                test: wizard.check,
                save: wizard.save,
                finish: wizard.finish,
                close: () => props.onClose(savedId !== null),
                retry: wizard.reload,
                folders: wizard.setFolders,
                since: (value: string) => wizard.setSinceDays(Number(value)),
                schedule: (value: string) => wizard.setEvery(value === "null" ? null : Number(value)),
                agents: wizard.setAgentIds,
            }}
        />
    )
}
/** Builds the ImapWizardContent section from the current view. */
const buildMailboxAccountView = ({
    copy,
    values,
    savedId,
    preset,
    t,
    isCustom,
    isPending,
    wizard,
    format,
}: BuildMailboxAccountViewContext) =>
    ({
        fields: {
            props: {
                values: { ...values, user: values.user || (savedId === null ? values.email : "") },
                preset,
                presets: IMAP_PRESETS.map((p) => ({ id: p.id, label: t(IMAP_PRESET_KEY[p.id]) })),
                securities: [
                    { id: "tls", label: t("secTls") },
                    { id: "starttls", label: t("secStarttls") },
                ],
                isCustom,
                passwordHint: savedId === null ? t("passwordHint") : t("passwordKeep"),
                isDisabled: isPending,
                text: copy.fields,
            },
            on: { field: wizard.setField, preset: wizard.pickPreset, security: wizard.pickSecurity },
        },
        server: isCustom ? null : `${values.host}:${values.port}`,
        guide: t(IMAP_GUIDE_KEY[preset]),
        starttls: values.security === "starttls" ? t("starttlsWarn") : null,
        canTest: wizard.ready,
        tested: wizard.isTested ? t("testOk", { n: format.number(wizard.folderList.length) }) : null,
        stale: !wizard.isTested && wizard.wasTested ? t("testStale") : null,
    }) as const
/** Builds the ImapWizardContent section from the current view. */
const buildImapWizardView = ({
    copy,
    wizard,
    t,
    tc,
    tw,
    values,
    savedId,
    preset,
    isCustom,
    isPending,
    format,
    props,
    slotLabelsOf,
    phases,
}: BuildImapWizardViewContext) =>
    ({
        resume: slotOfReads([...props.dependencyReads, ...wizard.reads], () => ({
            isResumed: props.resumeId !== undefined,
        })),
        slotLabels: { ...slotLabelsOf(""), ...(wizard.loadError === null ? {} : { error: wizard.loadError }) },
        title: tc(providerKey("imap", "title")),
        stepLabel: tw("stepOf", { n: wizard.index + 1, total: IMAP_STEPS.length }),
        phases,
        steps: [t("stepAccount"), t("stepFolders"), t("stepSchedule"), t("stepAgent")],
        index: wizard.index,
        step: wizard.step,
        account: buildMailboxAccountView({ copy, values, savedId, preset, t, isCustom, isPending, wizard, format }),
        folders: {
            options: wizard.folderList.map((path) => ({ value: path, label: path })),
            value: wizard.folders,
            none: wizard.folders.length === 0 ? t("foldersNone") : null,
            since: String(wizard.sinceDays),
            sinceOptions: IMAP_SINCE_DAYS.map((days) => ({
                value: String(days),
                label: t(IMAP_SINCE_KEY[days]),
            })),
        },
        schedule: {
            value: String(wizard.every),
            options: IMAP_EVERY.map((e) => ({ value: String(e.minutes), label: t(e.key) })),
        },
        agentStep: {
            title: t("agentTitle"),
            notice: null,
            agents: agentChoicesOf(props.agents, tw),
            value: wizard.agentIds,
            hint: tw("agentHint"),
            none: tw("agentNone"),
        },
        error: wizard.error,
        isPending,
        isTested: wizard.isTested,
        text: copy.text,
    }) as const
