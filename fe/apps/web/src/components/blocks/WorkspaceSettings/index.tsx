"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useAvatarEditorView } from "@/hooks/avatar"
import { useMember, isManager } from "@/hooks/member"
import { useWorkspaceSettingsForm } from "@/hooks/rhf"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryWorkspaceSettingsSwr } from "@/hooks/swr"
import {
    useLogoRemoval,
    useTimeZoneOptions,
    useWorkspaceLogoUpload,
    useWorkspaceSettingsCommands,
} from "@/hooks/workspaceSettings"
import { WorkspaceSettingsBase } from "./component"

/**
 * The connected workspace settings block: the name and the time zone (saved with the one Save command) and the logo (uploaded or
 * removed at once, with a question before it is removed), read from and saved through the back end GraphQL API (each outcome
 * toasted). A member who is not owner or manager sees the values and cannot change them.
 */
export const WorkspaceSettings = () => {
    const t = useTranslations("settings")
    const member = useMember()
    const slotLabels = useSlotLabels()
    const read = useQueryWorkspaceSettingsSwr()
    const { data } = read
    const { saveSettings, isSaving } = useWorkspaceSettingsCommands()
    const logo = useWorkspaceLogoUpload()
    const editor = useAvatarEditorView(logo, data?.logoUrl !== null && data?.logoUrl !== undefined)
    const removal = useLogoRemoval(logo)
    const timeZones = useTimeZoneOptions(data?.timeZone)
    const zoneIds = useMemo(() => timeZones.map((zone) => zone.id), [timeZones])
    const form = useWorkspaceSettingsForm({ name: data?.name ?? "", timeZone: data?.timeZone ?? "" }, zoneIds)

    const submit = form.handleSubmit(async (values) => {
        await saveSettings(values.name, values.timeZone)
    })

    return (
        <WorkspaceSettingsBase
            props={{
                seed: member?.workspaceId,
                detailsTitle: t("detailsTitle"),
                name: form.watch("name"),
                nameLabel: t("nameLabel"),
                nameHint: t("nameHint"),
                nameError: form.formState.errors.name?.message,
                timeZone: form.watch("timeZone"),
                timeZoneLabel: t("timeZoneLabel"),
                timeZoneHint: t("timeZoneHint"),
                timeZonePlaceholder: t("timeZonePlaceholder"),
                timeZoneEmpty: t("timeZoneEmpty"),
                timeZoneError: form.formState.errors.timeZone?.message,
                timeZones,
                saveLabel: t("save"),
                failTitle: t("failTitle"),
                isPending: isSaving,
                canEdit: isManager(member),
                readOnlyNote: t("readOnlyNote"),
                logoTitle: t("logoTitle"),
                picture: logo.preview ?? data?.logoUrl ?? null,
                logo: {
                    ...editor,
                    label: t("logoLabel"),
                    pickLabel: t("logoPick"),
                    hint: t("logoHint"),
                    removeLabel: t("logoRemove"),
                },
                confirmRemove: removal.isAsking
                    ? {
                          title: t("logoRemoveTitle"),
                          body: t("logoRemoveBody"),
                          cancelLabel: t("cancel"),
                          isPending: logo.isBusy,
                      }
                    : undefined,
                slot: mapSlot(slotOfSwr(read), () => true as const),
                labels: slotLabels(t("loadFailed")),
            }}
            on={{
                retry: () => void read.mutate(),
                pick: (files) => void logo.choose(files),
                askRemove: removal.ask,
                cancelRemove: removal.cancel,
                remove: () => void removal.confirm(),
                setName: (value) =>
                    form.setValue("name", value, { shouldValidate: form.formState.isSubmitted, shouldDirty: true }),
                setTimeZone: (value) =>
                    form.setValue("timeZone", value, { shouldValidate: form.formState.isSubmitted, shouldDirty: true }),
                submit: () => void submit(),
            }}
        />
    )
}
