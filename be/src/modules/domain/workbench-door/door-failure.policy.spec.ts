import { Test } from "@nestjs/testing"
import { DomainError } from "@modules/platform/errors"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import { actionFailureOf as realActionFailureOf } from "./door-failure.policy"

const SUBJECT = Symbol("door-failure.policy")

interface Subject {
    readonly actionFailureOf: typeof realActionFailureOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { actionFailureOf: realActionFailureOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

class StandInError extends DomainError<string> {}

const engineFailure = (code: string): StandInError => new StandInError({ code })

describe("actionFailureOf", () => {
    let actionFailureOf: Subject["actionFailureOf"]

    beforeAll(async () => {
        ;({ actionFailureOf } = await build())
    })

    it.each([
        ["ENTITY_ENGINE_QUERY_INVALID", "invalid", WorkbenchDoorErrorCode.PayloadInvalid],
        ["ENTITY_ENGINE_SCOPE_VIOLATION", "forbidden", WorkbenchDoorErrorCode.PermissionDenied],
        ["ENTITY_ENGINE_CONSTRAINT_UNDECLARED", "conflict", WorkbenchDoorErrorCode.ActionConflict],
        ["ENTITY_ENGINE_FAILED", "failed", WorkbenchDoorErrorCode.ActionFailed],
    ])("answers %s by its kind as %s", (code, reason, expected) => {
        expect(actionFailureOf(engineFailure(code))).toEqual({ reason, code: expected })
    })

    it("tells the screen that trying again may succeed when the engine was unavailable", () => {
        expect(actionFailureOf(engineFailure("ENTITY_ENGINE_UNAVAILABLE"))).toEqual({
            reason: "failed",
            code: WorkbenchDoorErrorCode.ActionFailed,
            data: { retry: true },
        })
    })

    it.each([[new Error("boom")], [engineFailure("SALES_SOMETHING")], ["text"], [null]])(
        "does not know %p, which propagates",
        (cause) => {
            expect(actionFailureOf(cause)).toBeNull()
        },
    )
})
