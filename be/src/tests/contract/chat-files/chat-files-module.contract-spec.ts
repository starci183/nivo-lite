import type { Provider } from "@nestjs/common"
import { ChatFileReadsService, ChatFilesModule, ChatFilesService } from "@modules/domain/chat-files"

/** What a provider binds its token to: the token it reuses, the value it holds or the name of the class it builds. */
const targetOf = (provider: object): unknown => {
    if ("useExisting" in provider) return provider.useExisting
    if ("useValue" in provider) return provider.useValue
    return "useClass" in provider && typeof provider.useClass === "function" ? provider.useClass.name : undefined
}

/** The providers that bind a token (a symbol), as `[token name, what it is bound to]`. */
const bindingsOf = (providers: ReadonlyArray<Provider> | undefined): Array<[string | undefined, unknown]> =>
    (providers ?? []).flatMap((provider) =>
        typeof provider === "object" && "provide" in provider && typeof provider.provide === "symbol"
            ? [[provider.provide.description, targetOf(provider)]]
            : [],
    )

describe("ChatFilesModule", () => {
    const registered = ChatFilesModule.register({ storage: "OBJECTS" })

    it("binds the store the app root names", () => {
        expect(bindingsOf(registered.providers)).toEqual(
            expect.arrayContaining([["domain.chat-files.storage", "OBJECTS"]]),
        )
    })

    it("provides and exports the files of the Office", () => {
        const services = [ChatFilesService, ChatFileReadsService]

        expect(registered.providers).toEqual(expect.arrayContaining(services))
        expect(registered.exports).toEqual(services)
    })
})
