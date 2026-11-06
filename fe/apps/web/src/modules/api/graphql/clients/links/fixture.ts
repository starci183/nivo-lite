import { ApolloLink, Observable } from "@apollo/client"
import { fixtureAnswerOf } from "@/modules/fixture-api"

/**
 * Terminal link of a prototype build: answers every operation from the fixtures by name, never from the network. An operation with no
 * fixture answers no data, so the screen shows its error state.
 */
export const createFixtureLink = (): ApolloLink =>
    new ApolloLink(
        (operation) =>
            new Observable((observer) => {
                observer.next({ data: fixtureAnswerOf(operation.operationName ?? "", operation.variables) })
                observer.complete()
            }),
    )
