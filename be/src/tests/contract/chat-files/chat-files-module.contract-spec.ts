import type { Provider } from "@nestjs/common"
import { ChatFilesModule } from "@modules/domain/chat-files"
import { CustomerFilesService } from "../../../modules/domain/chat-files/customer-files.service"

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
    const registered = ChatFilesModule.register({ storage: "OBJECTS", assets: "ASSETS" })

    it("binds the stores the app root names (the whole-file store keeps the pictures customers send)", () => {
        expect(bindingsOf(registered.providers)).toEqual(
            expect.arrayContaining([
                ["domain.chat-files.storage", "OBJECTS"],
                ["domain.chat-files.assets", "ASSETS"],
            ]),
        )
        expect(bindingsOf(ChatFilesModule.register({ storage: "OBJECTS" }).providers).map(([token]) => token)).not.toContain(
            "domain.chat-files.assets",
        )
    })

    it("provides and exports the files of the customers", () => {
        expect(registered.providers).toEqual(expect.arrayContaining([CustomerFilesService]))
        expect(registered.exports).toEqual([CustomerFilesService])
    })
})
