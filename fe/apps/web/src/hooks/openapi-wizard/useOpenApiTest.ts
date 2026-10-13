"use client"

import { useMemo, useState } from "react"
import type { useOpenApiAuthForm } from "@/hooks/rhf"
import type { OpenApiTestType } from "@/modules/api"
import { isOpenApiPullable, openApiAuthOf } from "./openapi-wizard.shared"
import type { OpenApiOp, OpenApiPullDef } from "./openapi-wizard.shared"
import type { OpenApiCommands } from "./useOpenApiCommands"

/** What the test step of the OpenAPI wizard reads from the wizard. */
interface OpenApiTestInput {
    readonly commands: OpenApiCommands
    readonly authForm: ReturnType<typeof useOpenApiAuthForm>
    readonly connectionId: string | null
    readonly ops: ReadonlyArray<OpenApiOp>
    readonly pulls: ReadonlyArray<OpenApiPullDef>
    /** Stores the pull of one operation (the test fills in the paths it found). */
    readonly onPull: (op: OpenApiOp, pull: OpenApiPullDef | null) => void
    readonly onError: (message: string | null) => void
}

/** The test step of the OpenAPI wizard: which operation is tried, its query, and the answer of the last try. */
export const useOpenApiTest = ({ commands, authForm, connectionId, ops, pulls, onPull, onError }: OpenApiTestInput) => {
    const [testOpId, setTestOpId] = useState<string | null>(null)
    const [testQuery, setTestQuery] = useState("")
    const [testing, setTesting] = useState(false)
    const [result, setResult] = useState<OpenApiTestType | null>(null)

    const testable = useMemo(() => ops.filter(isOpenApiPullable), [ops])
    const activeTestId = testOpId ?? pulls[0]?.opId ?? testable[0]?.id ?? null
    const testOp = testable.find((o) => o.id === activeTestId) ?? null
    const testPull = pulls.find((p) => p.opId === activeTestId)

    const runTest = async () => {
        if (!testOp) return
        setTesting(true)
        setResult(null)
        const values = authForm.getValues()
        const answer = await commands.test({
            connectionId,
            baseUrl: values.baseUrl,
            auth: openApiAuthOf(values),
            op: testOp,
            fixedQuery: testPull ? testPull.fixedQuery : testQuery,
            itemsPath: testPull?.itemsPath ?? "",
        })
        setTesting(false)
        if (answer.kind !== "ok") return onError(answer.message)
        onError(null)
        setResult(answer.value)
        const found = answer.value
        if (testPull && found.itemCount > 0) {
            onPull(testOp, {
                ...testPull,
                itemsPath: testPull.itemsPath || found.itemsPath,
                idField: testPull.idField || found.idField,
                titleField: testPull.titleField || found.titleField,
            })
        }
    }

    return {
        testing,
        test: { testable, activeTestId, testOp, testPull, testQuery, result },
        runTest,
        setTestQuery,
        setTestOpId: (id: string | null) => {
            setTestOpId(id)
            setResult(null)
        },
    }
}
