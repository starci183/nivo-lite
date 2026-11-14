"use client"

import { useTranslations } from "next-intl"
import type { ReactElement } from "react"
import { useAgentRoute } from "@/hooks/installations"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { usePackageTemplate } from "@/hooks/templates"
import { AgentTemplatePackageBase, type AgentTemplatePackageBaseProps } from "./component"

type PreviewViewProps = AgentTemplatePackageBaseProps["props"]["preview"]

/** What the page hands the packaging form: the installation whose agent is packaged; empty on the loading route, which reads the address. */
interface AgentTemplatePackageProps {
    readonly installationId: string
}

/** The key and the names of the card, then its summaries, in reading order. */
const IDENTITY_FIELDS = ["key", "nameVi", "nameEn"] as const
const SUMMARY_FIELDS = ["summaryVi", "summaryEn"] as const

/** The groups a template can be filed under (the keys the modules carry). */
const CATEGORIES = ["sales_customer", "finance", "operations", "marketing", "hr"] as const

type Translate = ReturnType<typeof useTranslations<"agentTemplates">>
type PackagePreview = NonNullable<ReturnType<typeof usePackageTemplate>["preview"]>

/** The rows of what the package keeps, leaves out and needs, with the problems and suggestions, as the preview card draws them. */
const previewViewOf = (t: Translate, preview: PackagePreview | undefined): PreviewViewProps => {
    const report = preview?.report
    if (preview === undefined || report === undefined) return undefined
    const pkg = preview.package
    return {
        rows: [
            {
                id: "kept",
                term: t("keptTerm"),
                description: t("kept", { nodes: report.nodes, branches: report.branches }),
            },
            {
                id: "leftOut",
                term: t("leftOutTerm"),
                description: t("leftOut", {
                    brain: report.brainRefs,
                    sources: report.privateSources,
                    people: report.people,
                }),
            },
            {
                id: "needs",
                term: t("needsTerm"),
                description:
                    pkg === null
                        ? "-"
                        : t("needs", { providers: pkg.requiredProviders.join(", ") || "-" }),
            },
        ],
        problems: preview.problems,
        suggestions: preview.suggestions.map((suggestion) =>
            t(`suggest_${suggestion.target}`, { node: suggestion.nodeKey, branch: suggestion.branchKey }),
        ),
    }
}

/** The connected packaging form of one installed agent. */
export const AgentTemplatePackage = (props: AgentTemplatePackageProps): ReactElement => {
    const t = useTranslations("agentTemplates")
    const slotLabels = useSlotLabels()
    const { installationId } = useAgentRoute({ installationId: props.installationId === "" ? undefined : props.installationId })
    const packaging = usePackageTemplate(installationId)
    const fields = packaging.fields
    const preview = packaging.preview
    const pkg = preview?.package
    return (
        <AgentTemplatePackageBase
            props={{
                slot: mapSlot(packaging.slot, (version) => t("frozenVersion", { version: version.version })),
                slotLabels: slotLabels(t("noVersion")),
                title: t("noticeTitle"),
                note: t("packageNote"),
                fields: IDENTITY_FIELDS.map((name) => ({
                    name,
                    label: t(`field_${name}`),
                    value: fields[name],
                    ...(name === "key" ? { description: t("field_key_hint") } : {}),
                })),
                summaries: SUMMARY_FIELDS.map((name) => ({ name, label: t(`field_${name}`), value: fields[name] })),
                categoryLabel: t("field_category"),
                category: fields.category,
                categoryOptions: CATEGORIES.map((id) => ({ id, label: t(`category_${id}`) })),
                soulLabel: t("field_soul"),
                soul: fields.soul,
                changelogLabel: t("field_changelog"),
                changelog: fields.changelog,
                breakingLabel: t("breakingTitle"),
                breakingHint: t("breakingHint"),
                isBreaking: fields.breaking,
                cardTitle: t("cardTitle"),
                versionTitle: t("versionTitle"),
                noPreview: t("noPreview"),
                previewLabel: t("previewLabel"),
                packageLabel: t("packageLabel"),
                previewTitle: t("previewTitle"),
                problemsTitle: t("problemsTitle"),
                suggestionsTitle: t("suggestionsTitle"),
                emptyRows: ["kept", "leftOut", "needs"].map((id) => ({ id, term: t(`${id}Term`), description: "-" })),
                preview: previewViewOf(t, preview),
                canPackage: pkg !== undefined && pkg !== null,
                isPending: packaging.isPending,
                previewFailed: packaging.previewFailed,
            }}
            on={{
                retry: () => undefined,
                setField: packaging.setText,
                setCategory: (value) => packaging.setField("category", value),
                setSoul: (value) => packaging.setField("soul", value),
                setChangelog: (value) => packaging.setField("changelog", value),
                toggleBreaking: () => packaging.setField("breaking", !fields.breaking),
                showPreview: () => void packaging.showPreview(),
                savePackage: () => void packaging.savePackage(),
            }}
        />
    )
}
