import { WorkItemResponse } from "./work-item.response"

/** What the command bus answered: the work item the command became, or the reason it was refused. */
export class CommandResultResponse {
    /** True when the command became a work item. */
    ok!: boolean
    /** The work item, when the command was accepted. */
    item?: WorkItemResponse
    /** False when the same command about the same subject already existed. */
    created?: boolean
    /** The chain the item joined. */
    chainId?: string | null
    /** Its depth in the chain. */
    depth?: number
    /** Why the command was refused. */
    refused?: string
    /** The refusal in a sentence. */
    detail?: string
    /** The payload keys still missing. */
    missing?: ReadonlyArray<string>
}
