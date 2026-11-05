"use client"

import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import {
    useMutatePackageAgentTemplateSwr,
    useQueryAgentTemplatePreviewSwr,
    useQueryAgentGraphVersionsSwr,
    useQueryModuleInstallationsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { isTextField } from "./templates.shared"
import type { PackagePreviewData, PackagePreviewRequest } from "./templates.shared"

/** The fields the creator writes to package a version. */
export interface PackageFields {
    readonly key: string
    readonly nameVi: string
    readonly nameEn: string
    readonly summaryVi: string
    readonly summaryEn: string
    readonly category: string
    readonly soul: string
    readonly changelog: string
    readonly breaking: boolean
}

/** How long the form rests before the preview reads again. */
const PREVIEW_DELAY_MS = 700

const EMPTY: PackageFields = {
    key: "",
    nameVi: "",
    nameEn: "",
    summaryVi: "",
    summaryEn: "",
    category: "operations",
    soul: "",
    changelog: "",
    breaking: false,
}

/** What the packaging form reads and does. */
export interface PackageTemplateController {
    /** The newest frozen version of the agent graph. */
    readonly slot: DataSlot<{ readonly id: string; readonly version: number }>
    /** Its number, zero when none. */
    readonly newestVersion: number
    /** The fields written so far. */
    readonly fields: PackageFields
    /** Writes one field. */
    readonly setField: <K extends keyof PackageFields>(name: K, value: PackageFields[K]) => void
    /** Writes one text field of the card by its name. */
    readonly setText: (name: string, value: string) => void
    /** The last preview, or undefined. */
    readonly preview: PackagePreviewData | undefined
    /** True while a command runs. */
    readonly isPending: boolean
    /** The last automatic read failed: the form then offers the retry. */
    readonly previewFailed: boolean
    /** Reads what the package would keep and leave out. */
    readonly showPreview: () => Promise<void>
    /** Saves the next version of the template. */
    readonly savePackage: () => Promise<void>
}

/** The request that previews or packages one frozen version of the agent with what the creator wrote. */
const previewRequestOf = (agentId: string, graphVersionId: string, fields: PackageFields): PackagePreviewRequest => ({
    agentId,
    graphVersionId,
    key: fields.key,
    name: { vi: fields.nameVi, en: fields.nameEn },
    summary: { vi: fields.summaryVi, en: fields.summaryEn },
    category: fields.category,
    parameters: [],
    bindings: [],
    starterDocumentIds: [],
    soul: fields.soul,
    changelog: fields.changelog,
    breaking: fields.breaking,
})

/** Packaging one agent: its frozen versions, the preview of what would be kept and left out, and the save of the next version of the template. */
export const usePackageTemplate = (installationId: string): PackageTemplateController => {
    const t = useTranslations("agentTemplates")
    const run = useGraphQLWithToast()
    const installations = useQueryModuleInstallationsSwr()
    const agentId = installations.data?.find((installation) => installation.id === installationId)?.agentId ?? null
    const versions = useQueryAgentGraphVersionsSwr(agentId === null ? null : { agentId })
    const packager = useMutatePackageAgentTemplateSwr()
    const [fields, setFields] = useState<PackageFields>(EMPTY)
    const [asked, setAsked] = useState<PackagePreviewRequest | null>(null)
    const previewRead = useQueryAgentTemplatePreviewSwr(asked)
    const newest = versions.data?.reduce((best, version) => (version.version > best.version ? version : best))
    const slot = slotOfSwr({ data: newest, error: versions.error, isLoading: versions.isLoading })
    const request = useMemo(
        () => (agentId === null || newest === undefined ? null : previewRequestOf(agentId, newest.id, fields)),
        [agentId, newest, fields],
    )
    const isFilled = fields.key !== "" && fields.nameVi !== "" && fields.summaryVi !== ""
    // The preview follows the form: once the card is filled in it reads again a moment after the last change.
    useEffect(() => {
        if (request === null || !isFilled) return
        const timer = window.setTimeout(() => setAsked(request), PREVIEW_DELAY_MS)
        return () => window.clearTimeout(timer)
    }, [request, isFilled])
    const showPreview = async (): Promise<void> => {
        if (request === null) return
        setAsked(request)
        await previewRead.mutate()
    }
    const savePackage = async () => {
        if (request === null) return
        await run(() => packager.trigger(request), { successMessage: t("packaged") })
    }
    return {
        slot,
        newestVersion: newest?.version ?? 0,
        fields,
        setField: <K extends keyof PackageFields>(name: K, value: PackageFields[K]) =>
            setFields((current) => ({ ...current, [name]: value })),
        setText: (name: string, value: string) =>
            setFields((current) => (isTextField(name) ? { ...current, [name]: value } : current)),
        preview: previewRead.data,
        isPending: previewRead.isLoading || packager.isMutating,
        previewFailed: previewRead.error !== undefined,
        showPreview,
        savePackage,
    }
}
