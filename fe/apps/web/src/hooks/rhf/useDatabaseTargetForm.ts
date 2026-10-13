"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { DB_DEFAULT_PORT, DB_ENGINES } from "@/hooks/database-wizard"
import type { DbSavedConnection } from "@/modules/types"

/** The values of the database connect form; the port is text while it is typed. */
export interface DatabaseTargetValues {
    name: string
    engine: (typeof DB_ENGINES)[number]
    host: string
    port: string
    database: string
    user: string
    password: string
    ssl: boolean
}

/**
 * The database connect form (name, engine, host, port, database, user, password, SSL). The password may stay empty only when
 * the connection already has one stored (`passwordSaved`).
 */
export const useDatabaseTargetForm = (passwordSaved: boolean, saved: DbSavedConnection | null) => {
    const t = useTranslations("connectorDatabase")
    const schema = useMemo(
        () =>
            z.object({
                name: z.string().trim().min(1, t("needName")).max(80),
                engine: z.enum(["postgres", "mysql", "mssql"]),
                host: z.string().trim().min(1, t("needHost")).max(253),
                port: z
                    .string()
                    .regex(/^\d+$/u, t("badPort"))
                    .refine((value) => Number(value) >= 1 && Number(value) <= 65_535, t("badPort")),
                database: z.string().trim().min(1, t("needDatabase")).max(128),
                user: z.string().trim().min(1, t("needUser")).max(128),
                password: passwordSaved ? z.string().max(512) : z.string().min(1, t("needPassword")).max(512),
                ssl: z.boolean(),
            }),
        [t, passwordSaved],
    )
    return useForm<DatabaseTargetValues>({
        resolver: zodResolver(schema),
        defaultValues:
            saved === null
                ? {
                      name: "",
                      engine: "postgres",
                      host: "",
                      port: String(DB_DEFAULT_PORT.postgres),
                      database: "",
                      user: "",
                      password: "",
                      ssl: true,
                  }
                : {
                      name: saved.name,
                      engine: saved.target.engine,
                      host: saved.target.host,
                      port: String(saved.target.port),
                      database: saved.target.database,
                      user: saved.target.user,
                      password: "",
                      ssl: saved.target.ssl,
                  },
        mode: "onChange",
    })
}
