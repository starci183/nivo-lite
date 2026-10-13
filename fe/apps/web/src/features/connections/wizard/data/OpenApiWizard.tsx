"use client"

import { Alert, Button, Text } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { useLocale } from "@/i18n/client"
import { useOpenApiWizard } from "@/hooks/openapi-wizard"
import { PROVIDERS } from "@/lib/connection-providers"
import { AgentStep } from "../AgentStep"
import { WizardFrame } from "../WizardFrame"
import { AuthStep } from "./openapi/AuthStep"
import { PullsStep, ToolsStep } from "./openapi/PullsStep"
import { ScheduleStep } from "./openapi/ScheduleStep"
import { SourceStep } from "./openapi/SourceStep"
import { TestStep } from "./openapi/TestStep"
import type { DataWizardProps } from "./types"

/** Swagger / OpenAPI in the shared wizard frame: spec, auth, pulled operations, agent tools, schedule, test, agents. */
export const OpenApiWizard = ({ agents, resumeId, onClose }: DataWizardProps) => {
    const t = useTranslations("connectorOpenapi")
    const w = useTranslations("connectionWizard")
    const locale = useLocale()
    const wizard = useOpenApiWizard({ resumeId, onClose })
    const { on, source, test, step, index, isPending, testing } = wizard
    const def = PROVIDERS.openapi

    const back = (
        <Button variant="outline" isDisabled={isPending || testing} onPress={() => on.go(index - 1)}>
            {w("back")}
        </Button>
    )
    const next = (disabled = false) => (
        <Button variant="primary" isDisabled={disabled || isPending} onPress={() => on.go(index + 1)}>
            {w("next")}
        </Button>
    )

    const footers = {
        source: (
            <>
                <Button
                    variant="primary"
                    isPending={isPending}
                    isDisabled={!source.ready}
                    onPress={source.unchanged ? () => on.go(1) : on.loadSpec}
                >
                    {source.unchanged ? w("next") : t("loadSpec")}
                </Button>
                <Button variant="ghost" onPress={on.close}>
                    {w("close")}
                </Button>
            </>
        ),
        auth: (
            <>
                {next(!wizard.authReady)}
                {back}
            </>
        ),
        pulls: (
            <>
                {next()}
                {back}
            </>
        ),
        tools: (
            <>
                {next()}
                {back}
            </>
        ),
        schedule: (
            <>
                {next()}
                {back}
            </>
        ),
        test: (
            <>
                <Button variant="primary" isPending={isPending} isDisabled={testing || !source.name.trim()} onPress={on.save}>
                    {wizard.editing ? w("done") : t("saveAndContinue")}
                </Button>
                <Button
                    variant="outline"
                    isPending={testing}
                    isDisabled={isPending || !test.testOp || !wizard.authReady}
                    onPress={() => void on.runTest()}
                >
                    {t("testButton")}
                </Button>
                {back}
            </>
        ),
        agent: (
            <Button variant="primary" isPending={isPending} onPress={on.finish}>
                {w("done")}
            </Button>
        ),
    }

    return (
        <WizardFrame
            title={w("title", { provider: def.title[locale] })}
            steps={wizard.steps.map((s) => t(`step_${s}`))}
            index={index}
            footer={footers[step]}
        >
            {step === "source" ? (
                <SourceStep
                    name={source.name}
                    specUrl={source.specUrl}
                    specText={source.specText}
                    isDisabled={isPending}
                    onName={on.setName}
                    onSpecUrl={on.setSpecUrl}
                    onSpecText={on.setSpecText}
                />
            ) : null}
            {step === "auth" ? <AuthStep form={wizard.authForm} hasSecret={wizard.hasSecret} isDisabled={isPending} /> : null}
            {step === "pulls" ? (
                <PullsStep ops={wizard.ops} pulls={wizard.pulls} onPull={on.onPull} isDisabled={isPending} />
            ) : null}
            {step === "tools" ? (
                <ToolsStep ops={wizard.ops} tools={wizard.tools} onTools={on.setTools} isDisabled={isPending} />
            ) : null}
            {step === "schedule" ? (
                <ScheduleStep hasPulls={wizard.pulls.length > 0} schedule={wizard.schedule} onSchedule={on.setSchedule} />
            ) : null}
            {step === "test" ? (
                <TestStep
                    testable={test.testable}
                    activeId={test.activeTestId}
                    op={test.testOp}
                    pull={test.testPull}
                    query={test.testQuery}
                    testing={testing}
                    result={test.result}
                    onOp={on.setTestOpId}
                    onQuery={on.setTestQuery}
                />
            ) : null}
            {step === "agent" ? (
                <>
                    <Text size="sm" weight="semibold">
                        {t("agentTitle")}
                    </Text>
                    <AgentStep agents={agents} value={wizard.agentIds} onValue={on.setAgentIds} isDisabled={isPending} />
                </>
            ) : null}
            {wizard.error ? <Alert tone="negative" title={wizard.error} /> : null}
        </WizardFrame>
    )
}
