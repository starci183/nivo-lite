"use client"

import { useEffect, useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Input, RadioGroup, Select, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectorImap } from "@/i18n/dict/connectorImap"
import { PROVIDERS } from "@/lib/connection-providers"
import { useSetConnectionAgents } from "@/hooks/connections"
import { syncNow } from "@/lib/data-hub-actions"
import { loadImapView, saveImapConnection, testImapConnection, type ImapInput } from "@/lib/connectors/imap-actions"
import type { ImapSecurity } from "@/lib/connectors/imap"
import { AgentStep } from "../AgentStep"
import { FIELDS_CLASS } from "../classNames"
import { WizardFrame } from "../WizardFrame"
import { IMAP_PRESETS, defaultPort, presetOfHost, type ImapPresetId } from "./imap/presets"
import type { DataWizardProps } from "./types"

type Step = "account" | "folders" | "schedule" | "agent"
const STEPS: ReadonlyArray<Step> = ["account", "folders", "schedule", "agent"]
const SINCE = [7, 30, 90] as const
const EVERY: ReadonlyArray<{
    readonly key: "everyManual" | "every15" | "every60" | "every360"
    readonly minutes: number | null
}> = [
    { key: "everyManual", minutes: null },
    { key: "every15", minutes: 15 },
    { key: "every60", minutes: 60 },
    { key: "every360", minutes: 360 },
]

/**
 * The mailbox (IMAP, read only) wizard, owner only: 1 sign-in with a test that lists the folders, 2 folders and how far back the first sync
 * reads, 3 how often to sync, 4 attach agents. The connection is saved at the end of step 3; the password goes to the server once and is
 * never sent back (a blank password on an existing mailbox keeps the saved one).
 */
export const ImapWizard = ({ agents, resumeId, onClose }: DataWizardProps) => {
    const setConnectionAgents = useSetConnectionAgents()
    const t = useT(connectorImap)
    const locale = useLocale()
    const def = PROVIDERS.imap
    const [index, setIndex] = useState(0)
    const [loading, setLoading] = useState(Boolean(resumeId))
    const [savedId, setSavedId] = useState<string | null>(resumeId ?? null)
    const [preset, setPreset] = useState<ImapPresetId>("gmail")
    const [f, setF] = useState({ name: "", email: "", host: "imap.gmail.com", port: "993", user: "", password: "" })
    const [security, setSecurity] = useState<ImapSecurity>("tls")
    const [folderList, setFolderList] = useState<ReadonlyArray<string>>([])
    const [tested, setTested] = useState<string | null>(null)
    const [folders, setFolders] = useState<ReadonlyArray<string>>(["INBOX"])
    const [sinceDays, setSinceDays] = useState<number>(30)
    const [every, setEvery] = useState<number | null>(60)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        if (!resumeId) return
        void loadImapView(resumeId).then((r) => {
            setLoading(false)
            if (!r.ok) return setError(r.error)
            const v = r.data
            setPreset(presetOfHost(v.host))
            setF({ name: v.name, email: v.email, host: v.host, port: String(v.port), user: v.user, password: "" })
            setSecurity(v.security)
            setFolders(v.folders)
            setFolderList(v.folders)
            setSinceDays(v.sinceDays)
            setEvery(v.syncEveryMinutes)
            setAgentIds(v.agentIds)
        })
    }, [resumeId])

    const set = (k: keyof typeof f) => (v: string) => {
        setTested(null)
        setF((p) => ({ ...p, [k]: v }))
    }
    const pickPreset = (id: string) => {
        const p = IMAP_PRESETS.find((x) => x.id === id) ?? IMAP_PRESETS[0]
        setPreset(p.id)
        setTested(null)
        if (p.id !== "other") {
            setSecurity("tls")
            setF((s) => ({ ...s, host: p.host, port: String(p.port) }))
        }
    }
    const pickSecurity = (v: string) => {
        const s: ImapSecurity = v === "starttls" ? "starttls" : "tls"
        setSecurity(s)
        setTested(null)
        setF((p) => ({ ...p, port: String(defaultPort(s)) }))
    }

    const step = STEPS[index]
    const names = [t("stepAccount"), t("stepFolders"), t("stepSchedule"), t("stepAgent")]
    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }
    const user = f.user.trim() || f.email.trim()
    const input = (): ImapInput => ({
        ...(savedId ? { connectionId: savedId } : {}),
        name: f.name,
        email: f.email.trim(),
        host: f.host,
        port: Number(f.port),
        security,
        user,
        password: f.password,
    })
    const stamp = `${f.host}|${f.port}|${security}|${user}|${f.password}`
    const ready = Boolean(
        f.name.trim() && f.email.trim() && f.host.trim() && Number(f.port) > 0 && user && (f.password || savedId),
    )
    const isTested = tested === stamp

    const check = () =>
        startTransition(async () => {
            setError(null)
            const r = await testImapConnection(input())
            if (!r.ok) return setError(r.error)
            setTested(stamp)
            setFolderList([...new Set([...r.data.folders, ...folders])])
            if (!folders.length) setFolders(r.data.folders.includes("INBOX") ? ["INBOX"] : r.data.folders.slice(0, 1))
        })

    const save = () =>
        startTransition(async () => {
            setError(null)
            const r = await saveImapConnection({ ...input(), folders, sinceDays, syncEveryMinutes: every })
            if (!r.ok) return setError(r.error)
            setSavedId(r.data.id)
            setF((p) => ({ ...p, password: "" }))
            go(3)
        })

    const finish = () => {
        if (!savedId) return onClose(false)
        startTransition(async () => {
            const r = await setConnectionAgents(savedId, agentIds)
            if (r.kind !== "ok") return setError(r.message)
            void syncNow(savedId)
            onClose(true)
        })
    }

    const back = (
        <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>
            {t("back")}
        </Button>
    )
    const footer =
        step === "account" ? (
            <>
                <Button variant="primary" isDisabled={!isTested} onPress={() => go(1)}>
                    {t("next")}
                </Button>
                <Button variant="ghost" onPress={() => onClose(savedId !== null)}>
                    {t("close")}
                </Button>
            </>
        ) : step === "folders" ? (
            <>
                <Button variant="primary" isDisabled={folders.length === 0} onPress={() => go(2)}>
                    {t("next")}
                </Button>
                {back}
            </>
        ) : step === "schedule" ? (
            <>
                <Button variant="primary" isPending={isPending} onPress={save}>
                    {isPending ? t("saving") : t("save")}
                </Button>
                {back}
            </>
        ) : (
            <>
                <Button variant="primary" isPending={isPending} onPress={finish}>
                    {t("done")}
                </Button>
            </>
        )

    const guide =
        preset === "gmail"
            ? t("guideGmail")
            : preset === "outlook"
              ? t("guideOutlook")
              : preset === "zoho"
                ? t("guideZoho")
                : preset === "yahoo"
                  ? t("guideYahoo")
                  : t("guideOther")
    const presetLabel = (id: ImapPresetId) =>
        t(
            id === "gmail"
                ? "presetGmail"
                : id === "outlook"
                  ? "presetOutlook"
                  : id === "zoho"
                    ? "presetZoho"
                    : id === "yahoo"
                      ? "presetYahoo"
                      : "presetOther",
        )

    if (loading) return <Text tone="muted">{t("loading")}</Text>

    return (
        <WizardFrame title={def.title[locale]} steps={names} index={index} footer={footer}>
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
                            value={f.name}
                            onValueChange={(v) => setF((p) => ({ ...p, name: v }))}
                        />
                        <Input
                            id="imap-email"
                            name="email"
                            label={t("fieldEmail")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={f.email}
                            onValueChange={(v) => {
                                setTested(null)
                                setF((p) => ({ ...p, email: v }))
                            }}
                        />
                        <Select
                            label={t("fieldProvider")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={preset}
                            options={IMAP_PRESETS.map((p) => ({ id: p.id, label: presetLabel(p.id) }))}
                            onValueChange={(v) => v && pickPreset(v)}
                        />
                        {preset === "other" ? (
                            <>
                                <Input
                                    id="imap-host"
                                    name="host"
                                    label={t("fieldHost")}
                                    variant="secondary"
                                    isDisabled={isPending}
                                    value={f.host}
                                    onValueChange={set("host")}
                                />
                                <Input
                                    id="imap-port"
                                    name="port"
                                    label={t("fieldPort")}
                                    variant="secondary"
                                    isDisabled={isPending}
                                    value={f.port}
                                    onValueChange={set("port")}
                                />
                                <Select
                                    label={t("fieldSecurity")}
                                    variant="secondary"
                                    isDisabled={isPending}
                                    value={security}
                                    options={[
                                        { id: "tls", label: t("secTls") },
                                        { id: "starttls", label: t("secStarttls") },
                                    ]}
                                    onValueChange={(v) => v && pickSecurity(v)}
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
                            value={f.user || (savedId ? "" : f.email)}
                            onValueChange={set("user")}
                        />
                        <Input
                            id="imap-password"
                            name="password"
                            kind="password"
                            label={t("fieldPassword")}
                            variant="secondary"
                            hint={savedId ? t("passwordKeep") : t("passwordHint")}
                            isDisabled={isPending}
                            value={f.password}
                            onValueChange={set("password")}
                        />
                    </div>
                    {preset !== "other" ? <Text size="xs" tone="muted">{`${f.host}:${f.port}`}</Text> : null}
                    <Text size="sm" tone="muted">
                        {guide}
                    </Text>
                    <Text size="xs" tone="muted">
                        {t("imapOn")}
                    </Text>
                    {security === "starttls" ? <Alert tone="cautionary" title={t("starttlsWarn")} /> : null}
                    <div>
                        <Button variant="outline" isPending={isPending} isDisabled={!ready} onPress={check}>
                            {isPending ? t("testing") : t("test")}
                        </Button>
                    </div>
                    {isTested ? <Alert tone="affirmative" title={t("testOk", { n: folderList.length })} /> : null}
                    {!isTested && tested ? (
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
                        options={folderList.map((p) => ({ value: p, label: p }))}
                        value={[...folders]}
                        onValueChange={(v) => setFolders(v)}
                    />
                    {folders.length === 0 ? (
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
                        value={String(sinceDays)}
                        onValueChange={(v) => setSinceDays(Number(v))}
                        options={SINCE.map((d) => ({
                            value: String(d),
                            label: t(d === 7 ? "since7" : d === 30 ? "since30" : "since90"),
                        }))}
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
                        value={String(every)}
                        onValueChange={(v) => setEvery(v === "null" ? null : Number(v))}
                        options={EVERY.map((e) => ({ value: String(e.minutes), label: t(e.key) }))}
                    />
                </>
            ) : null}

            {step === "agent" ? (
                <>
                    <Alert tone="affirmative" title={t("agentSaved")} />
                    <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
                </>
            ) : null}

            {error ? <Alert tone="negative" title={error} /> : null}
        </WizardFrame>
    )
}
