"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "../config";

export const supabaseBrowser = () => createBrowserClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey);
