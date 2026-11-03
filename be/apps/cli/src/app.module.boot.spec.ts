import { NestFactory } from "@nestjs/core"
import { everyKeyEnv } from "@tests/fixtures/builders/boot-env.builder"
import { AppModule } from "./app.module"
import { readCliEnv } from "./cli.env"

describe("cli app root", () => {
    it("resolves its whole module graph, so a provider no module gives fails here and not at boot", async () => {
        const context = await NestFactory.createApplicationContext(AppModule.register(readCliEnv(everyKeyEnv())), {
            preview: true,
            abortOnError: false,
            logger: false,
        })
        await context.close()
    })
})
