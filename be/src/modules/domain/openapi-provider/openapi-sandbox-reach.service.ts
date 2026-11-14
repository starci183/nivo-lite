import { Injectable } from "@nestjs/common"
import type { AccountBase, AccountKey } from "@modules/domain/openapi-tools"
import { ProviderSandboxError, ProviderSandboxErrorCode, ProviderSandboxService, type SandboxState } from "@modules/domain/provider-sandbox"
import {
    OPENAPI_CALL_OPERATION,
    OPENAPI_SANDBOX_CASE,
    OPENAPI_SANDBOX_FAILURE_STATUS,
    OPENAPI_SANDBOX_REFUSAL_STATUS,
    OPENAPI_SANDBOX_TIMEOUT_STATUS,
} from "./openapi-sandbox.catalogue"
import type { OpenApiSandboxOperationFixture } from "./openapi-sandbox-fixtures.contracts"
import { OpenApiSandboxFixturesRegistryService } from "./openapi-sandbox-fixtures-registry.service"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import type { OpenApiReachAccount, OpenApiReachAnswer, OpenApiReachCall, OpenApiReachPort } from "./openapi-reach.contracts"

/** The value a sandbox account's "key" carries: no secret exists for a sandbox account; the call never leaves the process. */
export const OPENAPI_SANDBOX_KEY_VALUE = "sandbox"

/** The state name a kept record of a collection lives under (key = the record's key). */
const recordState = (collection: string): string => `record:${collection}`

/** The state name of the keys a collection kept, in the order they were kept (key `""`). */
const indexState = (collection: string): string => `records:${collection}`

/** A JSON object, or null. */
const objectOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null

/** A text key of a value (a text or a number), or null. */
const keyTextOf = (value: unknown): string | null =>
    typeof value === "string" && value !== "" ? value : typeof value === "number" ? String(value) : null

/** The keys a collection kept (empty for a new account). */
const keptKeysOf = (kept: unknown): ReadonlyArray<string> => (Array.isArray(kept) ? kept.filter((one): one is string => typeof one === "string") : [])

/** One answer of a status and a JSON body. */
const answerOf = (status: number, body: unknown): OpenApiReachAnswer => ({ status, text: JSON.stringify(body) })

@Injectable()
/**
 * The SANDBOX reach of an API account (the OpenAPI provider's port for a sandbox account): it never reaches a host, holds no key and
 * answers every call of every pinned operation GENERICALLY (R75: it knows operation ids, collections and fields as the package's data,
 * never a system's noun). The account's next case of `call` picks the outcome (R62; `OPENAPI-1` by default): the package's fixture of
 * the operation (a write that `keeps` is remembered per account and read back by a later `readsBack` / `listsBack` read), a refusal
 * (422), a failure (503), or an applied write whose answer is lost (kept, then 504). An operation the package shipped no fixture for is
 * refused `PROVIDER_SANDBOX_CASE_UNKNOWN` (`<connector>:<operationId>`): the gap is the package's, never a guessed answer. One logged
 * call per request.
 */
export class OpenApiSandboxReachService implements OpenApiReachPort {
    readonly provider = OPENAPI_PROVIDER

    constructor(
        private readonly sandbox: ProviderSandboxService,
        private readonly fixtures: OpenApiSandboxFixturesRegistryService,
    ) {}

    /** No host is reached: nothing to refuse (a live account, or the sandbox off, is refused). */
    async reachable(account: OpenApiReachAccount, _base: AccountBase): Promise<void> {
        await Promise.resolve()
        this.sandbox.assertOpen(account)
    }

    /** The account's stand-in key: a sandbox account holds no secret, and the call never leaves the process. */
    async keyOf(account: OpenApiReachAccount, base: AccountBase): Promise<AccountKey | null> {
        await Promise.resolve()
        this.sandbox.assertOpen(account)
        return { type: base.authType, name: base.authName, value: OPENAPI_SANDBOX_KEY_VALUE }
    }

    /** No live document: the pinned one stands (a live account, or the sandbox off, is refused). */
    async liveDocument(account: OpenApiReachAccount, _url: string): Promise<string | null> {
        await Promise.resolve()
        this.sandbox.assertOpen(account)
        return null
    }

    /** Answers one call from the account's next case and the package's fixtures; one logged call. */
    call(account: OpenApiReachAccount, call: OpenApiReachCall): Promise<OpenApiReachAnswer> {
        return this.sandbox.call(
            account,
            OPENAPI_CALL_OPERATION,
            { connector: account.connector, operationId: call.operationId, method: call.method, path: call.path, input: call.input },
            {
                key: call.operationId,
                answer: async (state) => {
                    if (state.nextCase === OPENAPI_SANDBOX_CASE.refused) {
                        return answerOf(OPENAPI_SANDBOX_REFUSAL_STATUS, { message: "refused by the sandbox case OPENAPI-2" })
                    }
                    if (state.nextCase === OPENAPI_SANDBOX_CASE.failed) {
                        return answerOf(OPENAPI_SANDBOX_FAILURE_STATUS, { message: "failed by the sandbox case OPENAPI-3" })
                    }
                    const fixture = this.fixtureOf(account.connector, call.operationId)
                    const answer = await this.answered(fixture, call, state)
                    if (state.nextCase === OPENAPI_SANDBOX_CASE.timedOut) {
                        return answerOf(OPENAPI_SANDBOX_TIMEOUT_STATUS, { message: "answer lost by the sandbox case OPENAPI-4" })
                    }
                    return answer
                },
            },
        )
    }

    /** The package's fixture of the operation, or the typed refusal naming the gap. */
    private fixtureOf(connector: string, operationId: string): OpenApiSandboxOperationFixture {
        const fixture = this.fixtures.of(connector)?.operations[operationId]
        if (fixture === undefined) {
            throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.CaseUnknown, params: { caseId: `${connector}:${operationId}` } })
        }
        return fixture
    }

    /** The fixture's answer, after what it keeps (a write) or with what it reads back (a read). */
    private async answered(fixture: OpenApiSandboxOperationFixture, call: OpenApiReachCall, state: SandboxState): Promise<OpenApiReachAnswer> {
        if (fixture.keeps !== undefined) {
            const { collection, keyField } = fixture.keeps
            const given = objectOf(call.input.body)
            const base = objectOf(fixture.body) ?? {}
            const laid: Record<string, unknown> = { ...base, ...(given ?? {}) }
            const key = keyTextOf(laid[keyField]) ?? `sbx-${String(state.seq + 1)}`
            const record = { ...laid, [keyField]: laid[keyField] ?? key }
            await state.write(recordState(collection), key, record)
            const keys = keptKeysOf(await state.read(indexState(collection), ""))
            if (!keys.includes(key)) await state.write(indexState(collection), "", [...keys, key])
            return answerOf(fixture.status, record)
        }
        if (fixture.readsBack !== undefined) {
            const key = keyTextOf(call.input[fixture.readsBack.keyParam])
            const kept = key === null ? null : await state.read(recordState(fixture.readsBack.collection), key)
            return answerOf(fixture.status, kept ?? fixture.body)
        }
        if (fixture.listsBack !== undefined) {
            const { collection, listField } = fixture.listsBack
            const keys = keptKeysOf(await state.read(indexState(collection), ""))
            const records = await Promise.all(keys.map((key) => state.read(recordState(collection), key)))
            const kept = records.filter((one) => one !== null)
            if (Array.isArray(fixture.body)) return answerOf(fixture.status, [...(fixture.body as ReadonlyArray<unknown>), ...kept])
            const body = objectOf(fixture.body) ?? {}
            const listed = Array.isArray(body[listField]) ? (body[listField] as ReadonlyArray<unknown>) : []
            return answerOf(fixture.status, { ...body, [listField]: [...listed, ...kept] })
        }
        return answerOf(fixture.status, fixture.body)
    }
}
