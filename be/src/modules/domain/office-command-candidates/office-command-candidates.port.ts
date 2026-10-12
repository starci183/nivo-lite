import type { CommandProposalInput, DeepseekScope, ProposedCommand } from "@modules/integrations/deepseek"

/** Reads an owner's Office message into at most one command of one agent; the app root binds it to the prompt library. */
export interface CommandReader {
    /** The model's raw choice for the message; the caller validates it against the agent's contract. */
    proposeCommands(scope: DeepseekScope, input: CommandProposalInput): Promise<ProposedCommand>
}
