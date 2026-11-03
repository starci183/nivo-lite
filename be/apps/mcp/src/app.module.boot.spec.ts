import { NestFactory } from "@nestjs/core"
import { everyKeyEnv } from "@tests/fixtures/builders/boot-env.builder"
import { AppModule } from "./app.module"
import { readMcpEnv } from "./mcp.env"

describe("mcp app root", () => {
    it("resolves its whole module graph, so a provider no module gives fails here and not at boot", async () => {
        const context = await NestFactory.createApplicationContext(AppModule.register(readMcpEnv(everyKeyEnv())), {
            preview: true,
            abortOnError: false,
            logger: false,
        })
        await context.close()
    })
})
