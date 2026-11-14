import { isDomainError } from "@starci/common"
import { SdkDefinitionError } from "../block/definition-error"
import { RendererError } from "../client/renderer/renderer-error"
import { EntityDefinitionError } from "../entity/entity-error"
import { EntityRenderError } from "../entity/render-error"
import { ModuleListError } from "../module/module-list-error"
import { JobDefinitionError } from "../mutation/job-definition-error"
import { JobRefused } from "../mutation/job-door"
import { JobRetry } from "../mutation/job-retry"
import { SagaDefinitionError } from "../mutation/saga-definition-error"
import { NodeBusinessFailure, NodeConfused } from "../node/memory"
import { NodeRunError } from "../node/node-run-error"
import { RightsDeniedError } from "../node/rights-denied-error"
import { ToolUndeclaredError } from "../node/tool-undeclared-error"
import { VocabularyError } from "../node/vocabulary"
import { QueryBuildError } from "../query/query-error"
import { PlanError } from "../spec/plan-error"
import { FixtureError } from "../tests/fixtures/fixture-error"

/**
 * The coded errors the SDK itself raises. They all extend `DomainError` (there is no SDK base class any more), so a thrown coded error is
 * the SDK's only when it is an instance of one of these: any other `DomainError` (the entity engine's, the back end's own) is not a
 * failure of an SDK call and must reach its own handler. A new SDK error class is added here.
 */
const SDK_ERRORS: ReadonlyArray<
    abstract new (...parameters: Array<never>) => {
        readonly code: string
        readonly params: Readonly<Record<string, unknown>>
    }
> = [
    SdkDefinitionError,
    RendererError,
    EntityDefinitionError,
    EntityRenderError,
    ModuleListError,
    JobDefinitionError,
    JobRefused,
    JobRetry,
    SagaDefinitionError,
    NodeBusinessFailure,
    NodeConfused,
    NodeRunError,
    RightsDeniedError,
    ToolUndeclaredError,
    VocabularyError,
    QueryBuildError,
    PlanError,
    FixtureError,
]

/** The code and subject of a coded error of the SDK (`params.at`; empty when the error names none), or undefined for any other thrown value (a bug of the run or another package's error, which must propagate). */
export const sdkFailureOf = (error: unknown): { readonly code: string; readonly at: string } | undefined => {
    if (!isDomainError(error) || !SDK_ERRORS.some((kind) => error instanceof kind)) return undefined
    const at = error.params["at"]
    return { code: error.code, at: at === undefined ? "" : String(at) }
}
