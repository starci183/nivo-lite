"use client"

import { useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf } from "@/hooks/connection-wizard"
import { useOpenApiView, useOpenApiWizard } from "@/hooks/openapi-wizard"
import type { AgentOption } from "@/modules/types"
import { OpenApiWizardBase } from "./component"

/** What the board hands the OpenAPI wizard. */
interface OpenApiWizardProps {
    /** Workspace agents (any module): every agent may be given read access to a data source. */
    readonly agents: ReadonlyArray<AgentOption>
    /** Continue or edit this existing connection instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list refreshes. */
    readonly onClose: (changed: boolean) => void
}

/** Swagger / OpenAPI in the shared wizard frame: spec, auth, pulled operations, agent tools, schedule, test, agents. */
export const OpenApiWizard = (props: OpenApiWizardProps) => {
    const t = useTranslations("connectorOpenapi")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const wizard = useOpenApiWizard({ resumeId: props.resumeId, onClose: props.onClose })
    const view = useOpenApiView(wizard)
    const { source, picks, test, on } = wizard
    const hasPulls = picks.pulls.length > 0
    return (
        <OpenApiWizardBase
            props={{
                title: tw("title", { provider: tc(providerKey("openapi", "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: wizard.steps.length }),
                steps: view.steps,
                index: wizard.index,
                step: wizard.step,
                isPending: wizard.isPending,
                isTesting: test.testing,
                error: wizard.error,
                source: {
                    name: source.name,
                    specUrl: source.specUrl,
                    specText: source.specText,
                    isReady: source.ready,
                    isUnchanged: source.unchanged,
                },
                authReady: wizard.auth.ready,
                auth: { values: wizard.auth.values, options: view.authOptions, text: view.authText },
                pulls: {
                    rows: view.pullRows,
                    entityOptions: view.entityOptions,
                    query: picks.pullQuery,
                    isEmpty: picks.noGets,
                    tooMany: view.tooMany,
                    text: {
                        hint: t("pullsHint"),
                        search: t("search"),
                        empty: t("noGets"),
                        entity: t("entity"),
                        itemsPath: t("itemsPath"),
                        itemsPathHint: t("itemsPathHint"),
                        idField: t("idField"),
                        titleField: t("titleField"),
                        fixedQuery: t("fixedQuery"),
                    },
                },
                tools: {
                    options: view.toolOptions,
                    value: picks.toolValue,
                    query: picks.toolQuery,
                    text: { hint: t("toolsHint"), search: t("search"), empty: t("noOps"), label: t("toolsLabel") },
                },
                schedule: { hasPulls, options: view.scheduleOptions, value: picks.schedule },
                test: {
                    options: view.testOptions,
                    value: test.activeTestId,
                    showQuery: test.testOp !== null && test.testPull === undefined,
                    query: test.testQuery,
                    note: view.testNote,
                    fields: view.testFields,
                    text: {
                        hint: t("testHint"),
                        empty: t("noGets"),
                        operation: t("fieldTestOp"),
                        query: t("fixedQuery"),
                        testing: t("testing"),
                    },
                },
                canTest: test.testOp !== null && wizard.auth.ready,
                canSave: source.name.trim() !== "",
                agentStep: {
                    title: t("agentTitle"),
                    notice: null,
                    agents: agentChoicesOf(props.agents, "openapi", tw),
                    value: wizard.agentIds,
                    hint: tw("agentHint"),
                    none: tw("agentNone"),
                },
                text: {
                    back: tw("back"),
                    next: tw("next"),
                    close: tw("close"),
                    done: tw("done"),
                    save: wizard.editing ? tw("done") : t("saveAndContinue"),
                    loadSpec: t("loadSpec"),
                    testButton: t("testButton"),
                    name: t("fieldName"),
                    nameHint: t("fieldNameHint"),
                    specUrl: t("fieldSpecUrl"),
                    specUrlHint: t("fieldSpecUrlHint"),
                    specText: t("fieldSpecText"),
                    specTextHint: t("fieldSpecTextHint"),
                    schedule: t("fieldSchedule"),
                    scheduleHint: hasPulls ? t("scheduleHint") : t("scheduleNone"),
                },
            }}
            on={{
                go: on.go,
                close: on.close,
                loadSpec: on.loadSpec,
                save: on.save,
                runTest: test.runTest,
                finish: on.finish,
                name: source.setName,
                specUrl: source.setSpecUrl,
                specText: source.setSpecText,
                authField: on.authField,
                authType: on.authType,
                pullQuery: picks.setPullQuery,
                togglePull: picks.togglePull,
                patchPull: picks.patchPull,
                toolQuery: picks.setToolQuery,
                tools: picks.pickTools,
                schedule: picks.setSchedule,
                testOperation: test.pickOp,
                testQuery: test.setTestQuery,
                agents: on.setAgentIds,
            }}
        />
    )
}
