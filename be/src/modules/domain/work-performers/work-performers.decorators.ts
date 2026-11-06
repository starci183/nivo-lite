import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { PromptWriter } from "./work-performers.port"
import type { WorkspaceMailer } from "./workspace-mailer.contracts"

/** Token of the prompt writer port. */
export const PROMPT_WRITER: unique symbol = Symbol("domain.work-performers.prompt-writer")

/** Injects the prompt writer. Parameter type: PromptWriter. */
export const InjectPromptWriter = (): TypedParameterDecorator<PromptWriter> => injector<PromptWriter>(PROMPT_WRITER)

/** Token of the mail of the product, which sends the emails to customers through the authority gate. */
export const WORKSPACE_MAILER: unique symbol = Symbol("domain.work-performers.workspace-mailer")

/** Injects the mailer. Parameter type: WorkspaceMailer. */
export const InjectWorkspaceMailer = (): TypedParameterDecorator<WorkspaceMailer> =>
    injector<WorkspaceMailer>(WORKSPACE_MAILER)
