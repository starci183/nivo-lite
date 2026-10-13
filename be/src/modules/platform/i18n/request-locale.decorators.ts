import { createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import type { AcceptLanguage, Locale } from "./i18n.contracts"
import { pickLocale } from "./request-locale.policy"

/** The part of a request the locale is read from. */
interface LocaleRequest {
    /** The request headers. */
    readonly headers: Readonly<Record<string, AcceptLanguage>>
}

/** The GraphQL context the drivers build: the request the operation arrived on. */
interface LocaleGraphqlContext {
    /** The request. */
    readonly req: LocaleRequest
}

/** The `Accept-Language` header of the request behind a REST controller, a GraphQL resolver or a subscription. */
const acceptLanguageOf = (context: ExecutionContext): AcceptLanguage =>
    (context.getType<string>() === "graphql"
        ? GqlExecutionContext.create(context).getContext<LocaleGraphqlContext>().req
        : context.switchToHttp().getRequest<LocaleRequest>()
    ).headers["accept-language"]

/** The locale of the request, picked from its `Accept-Language` header: Vietnamese or English, Vietnamese by default. */
export const AcceptedLocale = createParamDecorator((_data: unknown, context: ExecutionContext): Locale =>
    pickLocale(acceptLanguageOf(context)),
)
