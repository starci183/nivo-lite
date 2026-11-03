"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import {
    useMutatePackageAgentTemplateSwr,
    useQueryAgentGraphVersionsSwr,
    useQueryModuleInstallationsSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { queryAgentTemplatePreview } from "@/modules/api/graphql/queries/query-agent-template-preview"
import type { QueryAgentTemplatePreviewRequest } from "@/modules/api/graphql/queries/query-agent-template-preview"

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

/** The text fields of the card, in reading order. */
export const TEXT_FIELDS: readonly ["key", "nameVi", "nameEn", "summaryVi", "summaryEn", "category"] = [
    "key",
    "nameVi",
    "nameEn",
    "summaryVi",
    "summaryEn",
    "category",
]

/** True when the name is one of the text fields of the card. */
const isTextField = (name: string): name is (typeof TEXT_FIELDS)[number] => TEXT_FIELDS.some((known) => known === name)

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

/** The preview a creator reads before packaging: what the package keeps, what it leaves out and why it is refused. */
export type PackagePreviewData = NonNullable<
    Awaited<ReturnType<typeof queryAgentTemplatePreview>>["data"]
>["agentTemplatePreview"]

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
    /** Reads what the package would keep and leave out. */
    readonly showPreview: () => Promise<void>
    /** Saves the next version of the template. */
    readonly savePackage: () => Promise<void>
}

/** Packaging one agent: its frozen versions, the preview of what would be kept and left out, and the save of the next version of the template. */
export const usePackageTemplate = (installationId: string): PackageTemplateController => {
    const t = useTranslations("agentTemplates")
    const run = useGraphQLWithToast()
    const installations = useQueryModuleInstallationsSwr()
    const agentId = installations.data?.find((installation) => installation.id === installationId)?.agentId ?? null
    const versions = useQueryAgentGraphVersionsSwr(agentId === null ? null : { agentId })
    const packager = useMutatePackageAgentTemplateSwr()
    const [fields, setFields] = useState<PackageFields>(EMPTY)
    const [preview, setPreview] = useState<PackagePreviewData | undefined>(undefined)
    const [isPreviewing, setIsPreviewing] = useState(false)
    const newest = versions.data?.reduce((best, version) => (version.version > best.version ? version : best))
    const slot = slotOfSwr({ data: newest, error: versions.error, isLoading: versions.isLoading })
    const requestOf = (): QueryAgentTemplatePreviewRequest | null =>
        agentId === null || newest === undefined
            ? null
            : {
                  agentId,
                  graphVersionId: newest.id,
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
              }
    const showPreview = async () => {
        const request = requestOf()
        if (request === null) return
        setIsPreviewing(true)
        const answered = await run(() => queryAgentTemplatePreview({ request }))
        setIsPreviewing(false)
        setPreview(answered?.data?.agentTemplatePreview)
    }
    const savePackage = async () => {
        const request = requestOf()
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
        preview,
        isPending: isPreviewing || packager.isMutating,
        showPreview,
        savePackage,
    }
}
