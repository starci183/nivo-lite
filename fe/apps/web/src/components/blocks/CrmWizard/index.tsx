"use client"

import { type SlotRead, slotOfReads, useSlotLabels } from "@/hooks/slot"
import { useLocale, useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { useWizardPhases } from "@/hooks/connection-wizard"
import { CRM_STEPS, useCrmWizard } from "@/hooks/crm-wizard"
import { crmReadinessOf, shortShaOf } from "@/modules/crm"
import { CrmWizardBase } from "./component"

/** What the board hands the CRM wizard. */
interface CrmWizardProps {
    /** The actual workspace reads shared with this selected wizard. */
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    /** Edit this existing CRM connection instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list refreshes. */
    readonly onClose: (changed: boolean) => void
}

/** The CRM provider via OpenAPI in the shared wizard frame: pick the CRM, address and key, then what the live Swagger came to. */
export const CrmWizard = (props: CrmWizardProps) => {
    const slotLabels = useSlotLabels()
    const t = useTranslations("connectorCrm")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const locale = useLocale()
    const phases = useWizardPhases("crm")
    const wizard = useCrmWizard({ resumeId: props.resumeId, onClose: props.onClose })
    const readiness = crmReadinessOf(wizard.result?.pin ?? null)
    return (
        <CrmWizardBase
            props={{
                boot: slotOfReads([...props.dependencyReads, ...wizard.reads], () => true),
                slotLabels: slotLabels(""),
                title: tw("title", { provider: tc(providerKey("openapi", "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: CRM_STEPS.length }),
                steps: [t("step_pick"), t("step_connect"), t("step_result")],
                phases,
                index: wizard.index,
                step: wizard.step,
                choices: [
                    ...wizard.templates.map((template) => ({
                        id: template.id,
                        title: locale === "en" ? template.label.en : template.label.vi,
                        subtitle: `crm.${template.id}`,
                    })),
                    { id: "other", title: t("otherTitle"), subtitle: t("otherHint") },
                ],
                picked: wizard.picked,
                template:
                    wizard.template === undefined
                        ? null
                        : {
                              crmId: `crm.${wizard.template.id}`,
                              auth:
                                  wizard.template.authType === "header"
                                      ? t("authHeaderNamed", { name: wizard.template.authName })
                                      : t("auth_bearer"),
                              swaggerPath: wizard.template.swaggerPath,
                              baseUrlHint: wizard.template.baseUrlHint,
                          },
                form: wizard.form,
                authOptions: [
                    { id: "bearer", label: t("auth_bearer") },
                    { id: "header", label: t("auth_header") },
                ],
                hasSecret: wizard.hasSecret,
                canPick: wizard.canPick,
                canSave: wizard.canSave,
                isPending: wizard.isPending,
                error: wizard.error,
                result:
                    wizard.result === null
                        ? null
                        : {
                              isCompatible: wizard.result.compatible,
                              summary:
                                  readiness.needed === 0
                                      ? t("resultNoNeeds", { count: wizard.result.pin.others.length })
                                      : t("resultReady", { ready: readiness.ready, needed: readiness.needed }),
                              snapshot: t("resultSnapshot", {
                                  sha: shortShaOf(wizard.result.pin.documentSha256),
                                  at: wizard.result.pin.pinnedAt.slice(0, 16).replace("T", " "),
                              }),
                              missing: readiness.missing.map((operation) => ({
                                  id: operation.op,
                                  title: operation.op,
                                  description: t(`state_${operation.state}`),
                              })),
                              drift: wizard.result.driftFromTemplate.join(", "),
                          },
                text: {
                    next: tw("next"),
                    back: tw("back"),
                    close: tw("close"),
                    save: t("save"),
                    done: t("done"),
                    pickLabel: t("pickLabel"),
                    factsTitle: t("factsTitle"),
                    factCrmId: t("factCrmId"),
                    factAuth: t("factAuth"),
                    factSwagger: t("factSwagger"),
                    fieldCrmId: t("fieldCrmId"),
                    fieldCrmIdHint: t("fieldCrmIdHint"),
                    fieldSwaggerUrl: t("fieldSwaggerUrl"),
                    fieldSwaggerUrlHint: t("fieldSwaggerUrlHint"),
                    fieldAuthType: t("fieldAuthType"),
                    fieldHeaderName: t("fieldHeaderName"),
                    fieldBaseUrl: t("fieldBaseUrl"),
                    fieldBaseUrlHint: t("fieldBaseUrlHint"),
                    fieldSecret: t("fieldSecret"),
                    secretHint: t("secretHint"),
                    secretSaved: t("secretSaved"),
                    resultDone: t("resultDone"),
                    resultMissingTitle: t("resultMissingTitle"),
                    resultMissingEmpty: t("resultMissingEmpty"),
                    resultMissingAlert: t("resultMissingAlert"),
                    driftTitle: t("driftTitle"),
                },
            }}
            on={wizard.on}
        />
    )
}
