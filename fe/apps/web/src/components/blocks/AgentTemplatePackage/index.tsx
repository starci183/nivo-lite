"use client"

import { useTranslations } from "next-intl"
import type { ReactElement } from "react"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { TEXT_FIELDS, usePackageTemplate } from "@/hooks/templates"
import { AgentTemplatePackageBase } from "./component"

/** What the page hands the packaging form: the installation whose agent is packaged. */
interface AgentTemplatePackageProps {
    readonly installationId: string
}

/** The connected packaging form of one installed agent. */
export const AgentTemplatePackage = (props: AgentTemplatePackageProps): ReactElement => {
    const t = useTranslations("agentTemplates")
    const slotLabels = useSlotLabels()
    const packaging = usePackageTemplate(props.installationId)
    const fields = packaging.fields
    const preview = packaging.preview
    const report = preview?.report
    const pkg = preview?.package
    return (
        <AgentTemplatePackageBase
            props={{
                slot: mapSlot(packaging.slot, (version) => t("frozenVersion", { version: version.version })),
                slotLabels: slotLabels(t("noVersion")),
                title: t("packageTitle"),
                note: t("packageNote"),
                fields: TEXT_FIELDS.map((name) => ({ name, label: t(`field_${name}`), value: fields[name] })),
                soulLabel: t("field_soul"),
                soul: fields.soul,
                changelogLabel: t("field_changelog"),
                changelog: fields.changelog,
                breakingLabel: fields.breaking ? t("breakingOn") : t("breakingOff"),
                previewLabel: t("previewLabel"),
                packageLabel: t("packageLabel"),
                previewTitle: t("previewTitle"),
                problemsTitle: t("problemsTitle"),
                suggestionsTitle: t("suggestionsTitle"),
                preview:
                    preview === undefined || report === undefined
                        ? undefined
                        : {
                              lines: [
                                  t("kept", { nodes: report.nodes, branches: report.branches }),
                                  t("leftOut", {
                                      brain: report.brainRefs,
                                      sources: report.privateSources,
                                      people: report.people,
                                      rights: report.rights,
                                  }),
                                  ...(pkg === undefined || pkg === null
                                      ? []
                                      : [
                                            t("needsLine", {
                                                providers: pkg.requiredProviders.join(", "),
                                                actions: pkg.requiredAuthorityActions.join(", "),
                                            }),
                                            t("willBe", { key: pkg.key, version: pkg.version }),
                                        ]),
                              ],
                              problems: preview.problems,
                              suggestions: preview.suggestions.map((suggestion) =>
                                  t(`suggest_${suggestion.target}`, {
                                      node: suggestion.nodeKey,
                                      branch: suggestion.branchKey,
                                  }),
                              ),
                          },
                canPackage: pkg !== undefined && pkg !== null,
                isPending: packaging.isPending,
            }}
            on={{
                retry: () => undefined,
                setField: packaging.setText,
                setSoul: (value) => packaging.setField("soul", value),
                setChangelog: (value) => packaging.setField("changelog", value),
                toggleBreaking: () => packaging.setField("breaking", !fields.breaking),
                showPreview: () => void packaging.showPreview(),
                savePackage: () => void packaging.savePackage(),
            }}
        />
    )
}
