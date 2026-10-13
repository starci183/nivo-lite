"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { DbEngine, DbSavedConnection } from "@/modules/types"

/** The values of the database connect form; the port is text while it is typed. */
export interface DatabaseTargetValues {
    name: string
    engine: DbEngine
    host: string
    port: string
    database: string
    user: string
    password: string
    ssl: boolean
}

/**
 * The database connect form (name, engine, host, port, database, user, password, SSL). The password may stay empty only when
 * the connection already has one stored (`passwordSaved`). A new connection starts on PostgreSQL at `postgresPort`; a saved one
 * (`saved`, possibly read after the first render) fills the form when it arrives.
 */
export const useDatabaseTargetForm = (
    passwordSaved: boolean,
    saved: DbSavedConnection | null,
    postgresPort: number,
) => {
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
    // A saved connection read after the first render replaces the blank form once (the password is never sent back).
    const loaded = useMemo<DatabaseTargetValues | undefined>(
        () =>
            saved === null
                ? undefined
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
        [saved],
    )
    return useForm<DatabaseTargetValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            engine: "postgres",
            host: "",
            port: String(postgresPort),
            database: "",
            user: "",
            password: "",
            ssl: true,
        },
        values: loaded,
        mode: "onChange",
    })
}
