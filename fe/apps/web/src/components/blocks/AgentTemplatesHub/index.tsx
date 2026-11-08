"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useTemplatesHub } from "@/hooks/templates"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentTemplatesHubBase, type AgentTemplatesHubData, type HubDialog } from "./component"

/** The shape of the hub while its first read loads: the skeleton reuses the ready tree. */
const PLACEHOLDER: AgentTemplatesHubData = {
    templates: [{ key: "-", name: "-", versions: [{ version: 1, line: "-" }] }],
    offers: [],
}

/** The connected hub of the templates of the caller: install, offer on the marketplace, and take the updates offered, branch by branch. */
export const AgentTemplatesHub = () => {
    const t = useTranslations("agentTemplates")
    const locale = useLocale()
    const slotLabels = useSlotLabels()
    const hub = useTemplatesHub()
    const pane = usePaneCopy()
    const [dialog, setDialog] = useState<HubDialog | null>(null)
    const offerById = hub.offerSlot
    return (
        <AgentTemplatesHubBase
            props={{
                slot: mapSlot(hub.slot, (templates): AgentTemplatesHubData => ({
                    templates: templates.map((template) => ({
                        key: template.key,
                        name: locale === "vi" ? template.name.vi : template.name.en,
                        versions: template.versions.map((version) => ({
                            version: version.version,
                            line: t("versionLine", { version: version.version, changelog: version.changelog }),
                        })),
                    })),
                    offers:
                        "items" in offerById
                            ? offerById.items.map((offer) => ({
                                  installationId: offer.installationId,
                                  title: t("offerTitle", {
                                      key: offer.key,
                                      installed: offer.installed,
                                      offered: offer.offered,
                                  }),
                                  changelog: offer.breaking
                                      ? t("breakingNote", { text: offer.changelog })
                                      : offer.changelog,
                                  safeUnitIds: hub.safeUnitIds(offer.units),
                                  units: offer.units.map((unit) => ({
                                      id: unit.id,
                                      line: t(`change_${unit.change}`, {
                                          node: unit.nodeKey,
                                          branch: unit.branchKey ?? "",
                                      }),
                                  })),
                              }))
                            : [],
                })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("empty")),
                mineTitle: t("mineTitle"),
                offersTitle: t("offersTitle"),
                valuesLabel: t("valuesLabel"),
                valuesHint: t("valuesHint"),
                valuesText: hub.valuesText,
                priceLabel: t("priceLabel"),
                price: hub.price,
                importLabel: t("importLabel"),
                submitLabel: t("submitLabel"),
                acceptSafeLabel: t("acceptSafeLabel"),
                acceptUnitLabel: t("acceptUnitLabel"),
                noOffers: t("noOffers"),
                notice: hub.notice,
                isPending: hub.isPending,
                cancelLabel: t("cancel"),
                moreLabel: pane.moreActions,
                dialog,
            }}
            on={{
                retry: hub.reload,
                openDialog: setDialog,
                setValuesText: hub.setValuesText,
                setPrice: hub.setPrice,
                importVersion: (key, version) => void hub.importVersion(key, version),
                submitVersion: (key, version) => void hub.submitVersion(key, version),
                accept: (installationId, unitIds) => void hub.accept(installationId, unitIds),
            }}
        />
    )
}
