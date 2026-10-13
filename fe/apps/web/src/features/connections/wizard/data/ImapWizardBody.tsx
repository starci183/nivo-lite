import { Alert, Button, CheckboxGroup, Input, RadioGroup, Select, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectorImap } from "@/i18n/dict/connectorImap"
import { PROVIDERS } from "@/lib/connection-providers"
import { IMAP_EVERY, IMAP_PRESETS, IMAP_SINCE_DAYS, useImapWizard } from "@/hooks/imap-wizard"
import type { ImapMailbox, ImapPresetId } from "@/hooks/imap-wizard"
import { AgentStep } from "../AgentStep"
import { FIELDS_CLASS } from "../classNames"
import { WizardFrame } from "../WizardFrame"
import type { DataWizardProps } from "./types"

/** What the mailbox wizard body takes: the drawer props and the saved mailbox, when resuming. */
interface ImapWizardBodyProps extends Pick<DataWizardProps, "agents" | "onClose"> {
    /** The saved mailbox being edited; absent for a new one. */
    readonly mailbox: ImapMailbox | undefined
}

const GUIDE_KEY = {
    gmail: "guideGmail",
    outlook: "guideOutlook",
    zoho: "guideZoho",
    yahoo: "guideYahoo",
    other: "guideOther",
} as const satisfies Record<ImapPresetId, string>

const PRESET_KEY = {
    gmail: "presetGmail",
    outlook: "presetOutlook",
    zoho: "presetZoho",
    yahoo: "presetYahoo",
    other: "presetOther",
} as const satisfies Record<ImapPresetId, string>

const SINCE_KEY = { 7: "since7", 30: "since30", 90: "since90" } as const

/**
 * The mailbox (IMAP, read only) wizard, owner only: 1 sign-in with a test that lists the folders, 2 folders and how far back the first sync
 * reads, 3 how often to sync, 4 attach agents. The connection is saved at the end of step 3; the password goes to the server once and is
 * never sent back (a blank password on an existing mailbox keeps the saved one).
 */
export const ImapWizardBody = ({ agents, mailbox, onClose }: ImapWizardBodyProps) => {
    const t = useT(connectorImap)
    const locale = useLocale()
    const wizard = useImapWizard({ mailbox, onClose })
    const { values, step, index, isPending, savedId, preset } = wizard
    const names = [t("stepAccount"), t("stepFolders"), t("stepSchedule"), t("stepAgent")]

    const back = (
        <Button variant="outline" isDisabled={isPending} onPress={() => wizard.go(index - 1)}>
            {t("back")}
        </Button>
    )
    const footers = {
        account: (
            <>
                <Button variant="primary" isDisabled={!wizard.isTested} onPress={() => wizard.go(1)}>
                    {t("next")}
                </Button>
                <Button variant="ghost" onPress={() => onClose(savedId !== null)}>
                    {t("close")}
                </Button>
            </>
        ),
        folders: (
            <>
                <Button variant="primary" isDisabled={wizard.folders.length === 0} onPress={() => wizard.go(2)}>
                    {t("next")}
                </Button>
                {back}
            </>
        ),
        schedule: (
            <>
                <Button variant="primary" isPending={isPending} onPress={wizard.save}>
                    {isPending ? t("saving") : t("save")}
                </Button>
                {back}
            </>
        ),
        agent: (
            <Button variant="primary" isPending={isPending} onPress={wizard.finish}>
                {t("done")}
            </Button>
        ),
    } as const

    return (
        <WizardFrame title={PROVIDERS.imap.title[locale]} steps={names} index={index} footer={footers[step]}>
            {step === "account" ? (
                <>
                    <Text size="sm" tone="muted">
                        {t("intro")}
                    </Text>
                    <div className={FIELDS_CLASS}>
                        <Input
                            id="imap-name"
                            name="name"
                            label={t("fieldName")}
                            variant="secondary"
                            hint={t("fieldNameHint")}
                            isDisabled={isPending}
                            value={values.name}
                            onValueChange={wizard.setField("name")}
                        />
                        <Input
                            id="imap-email"
                            name="email"
                            label={t("fieldEmail")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={values.email}
                            onValueChange={wizard.setField("email")}
                        />
                        <Select
                            label={t("fieldProvider")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={preset}
                            options={IMAP_PRESETS.map((p) => ({ id: p.id, label: t(PRESET_KEY[p.id]) }))}
                            onValueChange={(v) => v && wizard.pickPreset(v)}
                        />
                        {preset === "other" ? (
                            <>
                                <Input
                                    id="imap-host"
                                    name="host"
                                    label={t("fieldHost")}
                                    variant="secondary"
                                    isDisabled={isPending}
                                    value={values.host}
                                    onValueChange={wizard.setField("host")}
                                />
                                <Input
                                    id="imap-port"
                                    name="port"
                                    label={t("fieldPort")}
                                    variant="secondary"
                                    isDisabled={isPending}
                                    value={values.port}
                                    onValueChange={wizard.setField("port")}
                                />
                                <Select
                                    label={t("fieldSecurity")}
                                    variant="secondary"
                                    isDisabled={isPending}
                                    value={values.security}
                                    options={[
                                        { id: "tls", label: t("secTls") },
                                        { id: "starttls", label: t("secStarttls") },
                                    ]}
                                    onValueChange={(v) => v && wizard.pickSecurity(v)}
                                />
                            </>
                        ) : null}
                        <Input
                            id="imap-user"
                            name="user"
                            label={t("fieldUser")}
                            variant="secondary"
                            hint={t("fieldUserHint")}
                            isDisabled={isPending}
                            value={values.user || (savedId === null ? values.email : "")}
                            onValueChange={wizard.setField("user")}
                        />
                        <Input
                            id="imap-password"
                            name="password"
                            kind="password"
                            label={t("fieldPassword")}
                            variant="secondary"
                            hint={savedId === null ? t("passwordHint") : t("passwordKeep")}
                            isDisabled={isPending}
                            value={values.password}
                            onValueChange={wizard.setField("password")}
                        />
                    </div>
                    {preset === "other" ? null : <Text size="xs" tone="muted">{`${values.host}:${values.port}`}</Text>}
                    <Text size="sm" tone="muted">
                        {t(GUIDE_KEY[preset])}
                    </Text>
                    <Text size="xs" tone="muted">
                        {t("imapOn")}
                    </Text>
                    {values.security === "starttls" ? <Alert tone="cautionary" title={t("starttlsWarn")} /> : null}
                    <div>
                        <Button
                            variant="outline"
                            isPending={isPending}
                            isDisabled={!wizard.ready}
                            onPress={wizard.check}
                        >
                            {isPending ? t("testing") : t("test")}
                        </Button>
                    </div>
                    {wizard.isTested ? (
                        <Alert tone="affirmative" title={t("testOk", { n: wizard.folderList.length })} />
                    ) : null}
                    {!wizard.isTested && wizard.wasTested ? (
                        <Text size="xs" tone="muted">
                            {t("testStale")}
                        </Text>
                    ) : null}
                </>
            ) : null}

            {step === "folders" ? (
                <>
                    <Text size="sm" weight="semibold">
                        {t("foldersTitle")}
                    </Text>
                    <Text size="sm" tone="muted">
                        {t("foldersHint")}
                    </Text>
                    <CheckboxGroup
                        variant="secondary"
                        label={t("foldersTitle")}
                        isLabelHidden
                        options={wizard.folderList.map((p) => ({ value: p, label: p }))}
                        value={[...wizard.folders]}
                        onValueChange={wizard.setFolders}
                    />
                    {wizard.folders.length === 0 ? (
                        <Text size="xs" tone="muted">
                            {t("foldersNone")}
                        </Text>
                    ) : null}
                    <Text size="sm" weight="semibold">
                        {t("sinceTitle")}
                    </Text>
                    <Text size="sm" tone="muted">
                        {t("sinceHint")}
                    </Text>
                    <RadioGroup
                        variant="secondary"
                        label={t("sinceTitle")}
                        isLabelHidden
                        value={String(wizard.sinceDays)}
                        onValueChange={(v) => wizard.setSinceDays(Number(v))}
                        options={IMAP_SINCE_DAYS.map((d) => ({ value: String(d), label: t(SINCE_KEY[d]) }))}
                    />
                </>
            ) : null}

            {step === "schedule" ? (
                <>
                    <Text size="sm" tone="muted">
                        {t("scheduleHint")}
                    </Text>
                    <RadioGroup
                        variant="secondary"
                        label={t("stepSchedule")}
                        isLabelHidden
                        value={String(wizard.every)}
                        onValueChange={(v) => wizard.setEvery(v === "null" ? null : Number(v))}
                        options={IMAP_EVERY.map((e) => ({ value: String(e.minutes), label: t(e.key) }))}
                    />
                </>
            ) : null}

            {step === "agent" ? (
                <>
                    <Alert tone="affirmative" title={t("agentSaved")} />
                    <AgentStep
                        agents={agents}
                        value={wizard.agentIds}
                        onValue={wizard.setAgentIds}
                        isDisabled={isPending}
                    />
                </>
            ) : null}

            {wizard.error ? <Alert tone="negative" title={wizard.error} /> : null}
        </WizardFrame>
    )
}
