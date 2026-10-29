import type { ExecutionContext } from "@nestjs/common"
import { CommandBus, CommandHandler, CqrsModule, QueryHandler } from "@nestjs/cqrs"
import type { ICommandHandler, IQueryHandler } from "@nestjs/cqrs"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    AuthGuard,
    Credential,
    CredentialGuard,
    IdentityModule,
    Public,
    PublicReason,
    refuseSessions,
} from "@modules/domain/identity"
import type { OperationRequest } from "@modules/platform/http-security"
import type { JsonResult, ToolManifestEntry } from "@modules/domain/agent-tools"
import { GetToolManifestQuery } from "../../../features/api/agent-tools/application/get-tool-manifest.query"
import { RunToolCommand } from "../../../features/api/agent-tools/application/run-tool.command"
import { AgentToolsController } from "../../../features/api/agent-tools/transport/http/agent-tools.controller"

const CREDENTIAL_KEY = Credential({ kind: "tool-token" }).KEY
const PUBLIC_KEY = Public({ reason: PublicReason.Health }).KEY

@QueryHandler(GetToolManifestQuery)
/** A contract consumer of the manifest envelope; the real query bus delivers it. */
class ManifestConsumer implements IQueryHandler<GetToolManifestQuery> {
    execute(): Promise<ReadonlyArray<ToolManifestEntry>> {
        return Promise.resolve([])
    }
}

@CommandHandler(RunToolCommand)
/** A contract consumer of the tool envelope; no production handler is registered or replaced. */
class ToolConsumer implements ICommandHandler<RunToolCommand> {
    execute(): Promise<JsonResult> {
        return Promise.resolve({ answer: "found" })
    }
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [
            CqrsModule.forRoot(),
            IdentityModule.register({
                verifyAccessToken: refuseSessions,
            }),
        ],
        providers: [AgentToolsController, ManifestConsumer, ToolConsumer],
    }).compile()
    await moduleRef.init()
    return {
        moduleRef,
        controller: moduleRef.get(AgentToolsController),
        commandBus: moduleRef.get(CommandBus),
    }
}

describe("AgentToolsController", () => {
    it.each(["manifest", "run"] satisfies Array<keyof AgentToolsController>)(
        "requires a tool credential on %s",
        async (method) => {
            const { controller, moduleRef } = await build()
            const reflector = new Reflector()
            try {
                expect(reflector.get(CREDENTIAL_KEY, controller[method])).toEqual({ kind: "tool-token" })
                expect(reflector.get(PUBLIC_KEY, controller[method])).toBeUndefined()
            } finally {
                await moduleRef.close()
            }
        },
    )

    it("maps the manifest and tool response through their buses", async () => {
        const { controller, moduleRef, commandBus } = await build()
        const execute = jest.spyOn(commandBus, "execute")
        try {
            await expect(controller.manifest()).resolves.toEqual({ tools: [] })
            await expect(
                controller.run("Bearer tool", { tool: "knowledge.search" }, { query: "hours" }),
            ).resolves.toEqual({
                ok: true,
                result: { answer: "found" },
            })
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: {
                        request: { authorization: "Bearer tool", tool: "knowledge.search", args: { query: "hours" } },
                    },
                }),
            )
        } finally {
            execute.mockRestore()
            await moduleRef.close()
        }
    })

    it.each(["manifest", "run"] satisfies Array<keyof AgentToolsController>)(
        "fails closed on %s without a configured tool authenticator, even with a session",
        async (method) => {
            const { controller, moduleRef } = await build()
            const request = mock<OperationRequest>({
                headers: { authorization: "Bearer session" },
                principal: { id: "person-1", role: "authenticated" },
                credentialPrincipal: undefined,
            })
            const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
            http.getRequest.mockReturnValue(request)
            const context = mock<ExecutionContext>()
            context.getHandler.mockReturnValue(controller[method])
            context.getClass.mockReturnValue(AgentToolsController)
            context.switchToHttp.mockReturnValue(http)
            try {
                await expect(moduleRef.get(CredentialGuard).canActivate(context)).rejects.toMatchObject({
                    code: "IDENTITY_UNAUTHENTICATED",
                })
                expect(request.credentialPrincipal).toBeUndefined()
                await expect(moduleRef.get(AuthGuard).canActivate(context)).rejects.toMatchObject({
                    code: "IDENTITY_UNAUTHENTICATED",
                })
            } finally {
                await moduleRef.close()
            }
        },
    )
})
