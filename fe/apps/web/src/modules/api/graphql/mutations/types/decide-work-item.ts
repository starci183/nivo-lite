import type { Mutation, MutationDecideWorkItemArgs } from "../../__generated__/schema"

/** The input of the `decideWorkItem` mutation. */
export type MutateDecideWorkItemRequest = MutationDecideWorkItemArgs["input"]

/** The response of the `decideWorkItem` mutation. */
export type MutateDecideWorkItemResponse = Pick<Mutation, "decideWorkItem">
