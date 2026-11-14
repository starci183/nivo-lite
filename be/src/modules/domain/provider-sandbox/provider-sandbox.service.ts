import { Injectable } from "@nestjs/common"
import type {
    SandboxAccount,
    SandboxCall,
    SandboxCallOutcome,
    SandboxCallPlan,
    SandboxFixtureInput,
    SandboxScriptInput,
} from "./provider-sandbox.contracts"
import { InjectProviderSandboxStore } from "./provider-sandbox.decorators"
import { fixtureEntryOf, scriptEntryOf, thrownWordOf } from "./provider-sandbox.policy"
import type { ProviderSandboxStore } from "./provider-sandbox-store.port"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"

/** A sandbox door asked about a live account refuses it: no fixture, script, log or answer ever belongs to a live account. */
const sandboxOnly = (account: SandboxAccount): void => {
    if (account.sandbox !== true) {
        throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.LiveAccount, params: { connectionId: account.id } })
    }
}

@Injectable()
/**
 * THE GENERIC FRAME every provider's sandbox implementation answers through (lane concept provider-sandbox): for one call of one
 * operation on one sandbox account, a script first (it may fail the call with a generic failure kind the provider maps to its live error),
 * else the account's fixture, else the provider's own default; every call is logged with what it came to BEFORE it answers, so a test
 * reads back exactly what the provider was asked to do. It knows no provider and calls no network.
 */
export class ProviderSandboxService {
    constructor(@InjectProviderSandboxStore() private readonly store: ProviderSandboxStore) {}

    /** Answers one call of `operation` on a sandbox account by the plan's key; a live account is refused. */
    async call<Answer>(account: SandboxAccount, operation: string, request: unknown, plan: SandboxCallPlan<Answer>): Promise<Answer> {
        sandboxOnly(account)
        const key = plan.key ?? ""
        const script = await this.store.takeScript(account, operation, key)
        if (script?.outcome === "fail") {
            await this.log(account, operation, key, request, { outcome: "failed", failure: script.failure })
            throw plan.fail(script.failure)
        }
        const fixture = script === null ? await this.store.fixtureOf(account, operation, key) : null
        const by = script !== null ? "script" : fixture !== null ? "fixture" : "default"
        const given = script?.outcome === "answer" ? script.value : (fixture?.value ?? null)
        let answer: Answer
        try {
            answer = await plan.answer(given)
        } catch (cause) {
            await this.log(account, operation, key, request, { outcome: "threw", error: thrownWordOf(cause) })
            throw cause
        }
        await this.log(account, operation, key, request, { outcome: "answered", by, value: answer })
        return answer
    }

    /** Keeps a fixture of a sandbox account (the newest of an operation and key wins). */
    async fixture(account: SandboxAccount, input: SandboxFixtureInput): Promise<void> {
        sandboxOnly(account)
        await this.store.keep(account, fixtureEntryOf(input))
    }

    /** Keeps a script of a sandbox account (the newest with calls left wins; the exact key before the empty key). */
    async script(account: SandboxAccount, input: SandboxScriptInput): Promise<void> {
        sandboxOnly(account)
        await this.store.keep(account, scriptEntryOf(input))
    }

    /** The calls the account's sandbox implementations took, oldest first; of one operation when it is named. */
    async calls(account: SandboxAccount, operation?: string): Promise<ReadonlyArray<SandboxCall>> {
        sandboxOnly(account)
        return await this.store.calls(account, operation)
    }

    /** Forgets the account's fixtures and scripts; its call log stays. */
    async clearPlan(account: SandboxAccount): Promise<void> {
        sandboxOnly(account)
        await this.store.clearPlan(account)
    }

    private log(account: SandboxAccount, operation: string, key: string, request: unknown, result: SandboxCallOutcome): Promise<void> {
        return this.store.keep(account, { kind: "call", operation, key, body: { request: request ?? null, result }, remaining: null })
    }
}
