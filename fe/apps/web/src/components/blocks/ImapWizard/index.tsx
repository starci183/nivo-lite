"use client"

import { useFormatter, useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf, resumeSlotOfLoading } from "@/hooks/connection-wizard"
import { useSlotLabels } from "@/hooks/slot"
import type { AgentOption, SlotLabels } from "@/modules/types"
import {
    IMAP_EVERY,
    IMAP_GUIDE_KEY,
    IMAP_PRESET_KEY,
    IMAP_PRESETS,
    IMAP_SINCE_DAYS,
    IMAP_SINCE_KEY,
    IMAP_STEPS,
    useImapWizard,
} from "@/hooks/imap-wizard"
import { ImapWizardBase } from "./component"

/** What the board hands the mailbox wizard. */
interface ImapWizardProps {
    /** Workspace agents (any module): every agent may be given read access to the mailbox. */
    readonly agents: ReadonlyArray<AgentOption>
    /** Continue or edit this existing mailbox instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Inputs needed to build the ImapWizardContent section. */
interface BuildMailboxAccountViewContext {
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
}

/**
 * The mailbox (IMAP, read only) wizard, owner only: reads the saved mailbox when resuming, then sign in with a test that lists the
 * folders, folders and how far back the first sync reads, how often to sync (the mailbox is saved here), attach agents. A blank
 * password on an existing mailbox keeps the saved one.
 */
export const ImapWizard = (props: ImapWizardProps) => {
    const t = useTranslations("connectorImap")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const format = useFormatter()
    const slotLabelsOf = useSlotLabels()
    const wizard = useImapWizard({ resumeId: props.resumeId, onClose: props.onClose })
    const { values, preset, savedId, isPending } = wizard
    const isCustom = preset === "other"
    const context = { wizard, t, tc, tw, values, savedId, preset, isCustom, isPending, format, props, slotLabelsOf }
    return (
        <ImapWizardBase
            props={buildImapWizardView(context)}
            on={{
                go: wizard.go,
                test: wizard.check,
                save: wizard.save,
                finish: wizard.finish,
                close: () => props.onClose(savedId !== null),
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
                text: {
                    name: t("fieldName"),
                    nameHint: t("fieldNameHint"),
                    email: t("fieldEmail"),
                    provider: t("fieldProvider"),
                    host: t("fieldHost"),
                    port: t("fieldPort"),
                    security: t("fieldSecurity"),
                    user: t("fieldUser"),
                    userHint: t("fieldUserHint"),
                    password: t("fieldPassword"),
                },
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
}: BuildImapWizardViewContext) =>
    ({
        resume: resumeSlotOfLoading(wizard.loading, wizard.loadError),
        slotLabels: { ...slotLabelsOf(""), ...(wizard.loadError === null ? {} : { error: wizard.loadError }) },
        title: tc(providerKey("imap", "title")),
        stepLabel: tw("stepOf", { n: wizard.index + 1, total: IMAP_STEPS.length }),
        steps: [t("stepAccount"), t("stepFolders"), t("stepSchedule"), t("stepAgent")],
        index: wizard.index,
        step: wizard.step,
        account: buildMailboxAccountView({ values, savedId, preset, t, isCustom, isPending, wizard, format }),
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
            agents: agentChoicesOf(props.agents, "imap", tw),
            value: wizard.agentIds,
            hint: tw("agentHint"),
            none: tw("agentNone"),
        },
        error: wizard.error,
        isPending,
        isTested: wizard.isTested,
        text: {
            back: t("back"),
            next: t("next"),
            close: t("close"),
            done: t("done"),
            save: isPending ? t("saving") : t("save"),
            test: isPending ? t("testing") : t("test"),
            intro: t("intro"),
            imapOn: t("imapOn"),
            foldersTitle: t("foldersTitle"),
            foldersHint: t("foldersHint"),
            sinceTitle: t("sinceTitle"),
            sinceHint: t("sinceHint"),
            scheduleHint: t("scheduleHint"),
            scheduleLabel: t("stepSchedule"),
            saved: t("agentSaved"),
        },
    }) as const
