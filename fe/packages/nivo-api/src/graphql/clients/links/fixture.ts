import { ApolloLink, Observable } from "@apollo/client"

/** Parameters of the fixture link. */
export interface CreateFixtureLinkParams {
    /** The data the fixtures give an operation by name, or null when there is none. */
    answer: (operationName: string, variables: Readonly<Record<string, unknown>>) => Record<string, unknown> | null
}

/**
 * Terminal link of a prototype build: answers every operation from the fixtures by name, never from the network. An operation with no
 * fixture answers no data, so the screen shows its error state.
 */
export const createFixtureLink = ({ answer }: CreateFixtureLinkParams): ApolloLink =>
    new ApolloLink(
        (operation) =>
            new Observable((observer) => {
                observer.next({ data: answer(operation.operationName ?? "", operation.variables) })
                observer.complete()
            }),
    )
