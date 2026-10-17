"use client"

import type { OpenApiTestType, QueryTestOpenApiOperationRequest } from "@/hooks/swr"
import { useMemo, useState } from "react"
import { isOpenApiPullable } from "./openapi-wizard.shared"
import type { OpenApiOp, OpenApiPullDef } from "./openapi-wizard.shared"
import type { OpenApiCommands } from "./useOpenApiCommands"

/** What the test step reads of the wizard around it. */
interface OpenApiTestInput {
    readonly ops: ReadonlyArray<OpenApiOp>
    readonly pulls: ReadonlyArray<OpenApiPullDef>
    readonly commands: OpenApiCommands
    /** The saved connection, so the back end can use its stored secret. */
    readonly connectionId: string | null
    /** The typed address and sign-in, read when the test runs. */
    readonly target: () => Pick<QueryTestOpenApiOperationRequest, "baseUrl" | "auth">
    readonly onPull: (op: OpenApiOp, pull: OpenApiPullDef | null) => void
    /** Shows (or with null clears) the failure line. */
    readonly fail: (message: string | null) => void
}

/** The test step of the OpenAPI wizard: one GET called with the typed settings; a found list fills the empty mapping fields. */
export const useOpenApiTest = (input: OpenApiTestInput) => {
    const { ops, pulls, commands, onPull, fail } = input
    const [testOpId, setTestOpId] = useState<string | null>(null)
    const [testQuery, setTestQuery] = useState("")
    const [testing, setTesting] = useState(false)
    const [result, setResult] = useState<OpenApiTestType | null>(null)
    const testable = useMemo(() => ops.filter(isOpenApiPullable), [ops])
    const activeTestId = testOpId ?? pulls[0]?.opId ?? testable[0]?.id ?? null
    const testOp = testable.find((op) => op.id === activeTestId) ?? null
    const testPull = pulls.find((pull) => pull.opId === activeTestId)

    const runTest = async () => {
        if (testOp === null) return
        setTesting(true)
        setResult(null)
        const answer = await commands.test({
            ...input.target(),
            connectionId: input.connectionId,
            op: testOp,
            fixedQuery: testPull === undefined ? testQuery : testPull.fixedQuery,
            itemsPath: testPull?.itemsPath ?? "",
        })
        setTesting(false)
        if (answer.kind !== "ok") return fail(answer.message)
        fail(null)
        setResult(answer.value)
        const found = answer.value
        if (testPull === undefined || found.itemCount <= 0) return
        onPull(testOp, {
            ...testPull,
            itemsPath: testPull.itemsPath || found.itemsPath,
            idField: testPull.idField || found.idField,
            titleField: testPull.titleField || found.titleField,
        })
    }

    return {
        testable,
        activeTestId,
        testOp,
        testPull,
        testQuery,
        testing,
        result,
        setTestQuery,
        pickOp: (id: string | null) => {
            setTestOpId(id)
            setResult(null)
        },
        runTest: () => void runTest(),
    }
}
