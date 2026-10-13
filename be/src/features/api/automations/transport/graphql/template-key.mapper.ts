import type { BodyProposal } from "@modules/domain/automations"
import type { ProposeBodyRequest } from "../../application/propose-body.contracts"
import type { RunNowRequest } from "../../application/run-now.contracts"
import type { BodyProposalType } from "./dto/body-proposal.type"
import type { TemplateKeyInput } from "./dto/template-key.input"

/** Maps the GraphQL input to the request of a command that names one template. */
export const toTemplateRequest = (workspaceId: string, input: TemplateKeyInput): ProposeBodyRequest & RunNowRequest => ({
    workspaceId,
    templateKey: input.templateKey,
})

/** Maps the proposed wording to the GraphQL type. */
export const toBodyProposalType = (result: BodyProposal): BodyProposalType => ({ ...result })
