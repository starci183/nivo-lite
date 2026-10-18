import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import type { DaySummary, MonthLedger, OverdueInvoices, RunAuthorization } from "@modules/domain/n8n-runs"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { CompleteRunCommand } from "../../application/complete-run.command"
import { FetchDaySummaryQuery } from "../../application/fetch-day-summary.query"
import { FetchMonthLedgerQuery } from "../../application/fetch-month-ledger.query"
import { FetchOverdueInvoicesQuery } from "../../application/fetch-overdue-invoices.query"
import { SendEmailCommand } from "../../application/send-email.command"
import { CompleteRunRequest } from "./dto/complete-run.request"
import { DayRequest } from "./dto/day.request"
import { PeriodRequest } from "./dto/period.request"
import { RunIdRequest } from "./dto/run-id.request"
import { SendEmailRequest } from "./dto/send-email.request"
import { SendEmailResponse } from "./dto/send-email.response"
import { toCompletion, toRawEmail, toSendEmailResponse } from "./n8n-pipelines.mapper"

@Controller("api/n8n")
@Credential({ kind: "run-token" })
@RateLimit(RateTier.Strict)
/**
 * The doors the shared n8n workflows call back on. The global guard authenticates their run credentials: each call
 * proves itself with the bearer token of its own run, which the domain checks before any data is read or any mail is
 * sent.
 */
export class N8nPipelinesController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** The figures of a day and the owners to mail. */
    @Get("data/daily-summary")
    @Credential({ kind: "run-token", workflow: "email-daily-report" })
    daySummary(
        @Headers("authorization") authorization: RunAuthorization,
        @Query() query: DayRequest,
    ): Promise<DaySummary> {
        return this.queryBus.execute(
            new FetchDaySummaryQuery({
                request: { authorization, date: query.date },
            }),
        )
    }

    /** The overdue invoices of customers with an address, one item per reminder. */
    @Get("data/overdue-invoices")
    @Credential({ kind: "run-token", workflow: "email-debt-reminder" })
    overdueInvoices(@Headers("authorization") authorization = ""): Promise<OverdueInvoices> {
        return this.queryBus.execute(new FetchOverdueInvoicesQuery({ request: { authorization } }))
    }

    /** A month of the ledger as CSV text and as the variables of the email. */
    @Get("data/month-ledger")
    @Credential({ kind: "run-token", workflow: "email-month-ledger" })
    monthLedger(
        @Headers("authorization") authorization: RunAuthorization,
        @Query() query: PeriodRequest,
    ): Promise<MonthLedger> {
        return this.queryBus.execute(
            new FetchMonthLedgerQuery({
                request: { authorization, period: query.period },
            }),
        )
    }

    /** Sends one email of the running workflow. */
    @Post("email")
    @HttpCode(HttpStatus.OK)
    async email(
        @Headers("authorization") authorization: RunAuthorization,
        @Body() input: SendEmailRequest,
    ): Promise<SendEmailResponse> {
        const result = await this.commandBus.execute(
            new SendEmailCommand({
                request: { authorization, email: toRawEmail(input) },
            }),
        )
        return toSendEmailResponse(result)
    }

    /** Closes the run with how it ended. */
    @Post("runs/:id/complete")
    @HttpCode(HttpStatus.OK)
    complete(
        @Headers("authorization") authorization: RunAuthorization,
        @Param() params: RunIdRequest,
        @Body() input: CompleteRunRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new CompleteRunCommand({
                request: {
                    authorization,
                    runId: params.id,
                    report: toCompletion(input),
                },
            }),
        )
    }
}
