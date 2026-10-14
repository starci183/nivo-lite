"use client"

import { useTranslations } from "next-intl"
import type { WizardNote } from "@/modules/types"
import {
    isOpenApiPullable,
    OPEN_API_AUTH_TYPES,
    OPEN_API_PULL_ENTITIES,
    OPEN_API_SCHEDULES,
    OPEN_API_SHOWN,
    openApiOpLabel,
    requiredQueryOf,
} from "./openapi-wizard.shared"
import type { useOpenApiWizard } from "./useOpenApiWizard"

/** The state the view reads. */
type OpenApiWizardState = ReturnType<typeof useOpenApiWizard>

/** The OpenAPI wizard's lists and computed lines in the reader's language: step names, options, operation rows and the test answer. */
export const useOpenApiView = (wizard: OpenApiWizardState) => {
    const t = useTranslations("connectorOpenapi")
    const { auth, picks, test } = wizard
    const authType = auth.values.authType
    const byOp = new Map(picks.pulls.map((pull) => [pull.opId, pull]))
    const result = test.result
    const answered = result !== null && !result.error
    const failed: WizardNote | null = result?.error ? { tone: "negative", text: result.error } : null
    const found: WizardNote | null = answered
        ? {
              tone: result.itemCount > 0 ? "affirmative" : "informative",
              text: t("testOk", { status: result.status, n: result.itemCount }),
          }
        : failed
    return {
        steps: wizard.steps.map((step) => t(`step_${step}`)),
        authOptions: OPEN_API_AUTH_TYPES.map((type) => ({ id: type, label: t(`auth_${type}`) })),
        authText: {
            baseUrl: t("fieldBaseUrl"),
            baseUrlHint: auth.errors.baseUrl ?? t("fieldBaseUrlHint"),
            auth: t("fieldAuth"),
            authName: authType === "header" ? t("fieldHeaderName") : t("fieldQueryName"),
            authNameError: auth.errors.authName,
            authValue: authType === "bearer" ? t("fieldToken") : t("fieldKeyValue"),
            secretHint: auth.hasSecret ? t("keepSecretHint") : undefined,
            user: t("fieldUser"),
            password: t("fieldPassword"),
        },
        entityOptions: OPEN_API_PULL_ENTITIES.map((entity) => ({ id: entity, label: t(`entity_${entity}`) })),
        pullRows: picks.gets.map((op) => {
            const required = requiredQueryOf(op)
            const isPullable = isOpenApiPullable(op)
            return {
                id: op.id,
                label: openApiOpLabel(op),
                description: isPullable ? op.summary || undefined : t("needsPath"),
                isPullable,
                pull: byOp.get(op.id) ?? null,
                fixedQueryHint: required === "" ? null : t("fixedQueryHint", { names: required }),
            }
        }),
        tooMany: picks.tooMany ? t("tooMany", { n: OPEN_API_SHOWN }) : null,
        toolOptions: picks.visibleTools.map((op) => {
            const asks = op.summary ? `${op.summary} · ${t("alwaysAsk")}` : t("alwaysAsk")
            return {
                value: op.id,
                label: openApiOpLabel(op),
                description: op.method === "GET" ? op.summary || undefined : asks,
            }
        }),
        scheduleOptions: OPEN_API_SCHEDULES.map((schedule) => ({
            id: schedule.id,
            label: t(`schedule_${schedule.id}`),
        })),
        testOptions: test.testable.map((op) => ({ id: op.id, label: openApiOpLabel(op) })),
        testNote: found,
        testFields:
            answered && result.sampleKeys.length > 0 ? t("testFields", { fields: result.sampleKeys.join(", ") }) : null,
    }
}
