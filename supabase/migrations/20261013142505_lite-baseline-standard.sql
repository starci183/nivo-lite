-- Brings a database that applied the archived migrations (supabase/migrations/_archive/) to the standard of the lite baseline; on a
-- database created from the baseline every statement is a no-op. See be/docs/runbooks/cutover.md.

-- anon holds no table privilege (the schema's default privileges had granted it on every table).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Definer functions are not callable by anon.
REVOKE EXECUTE ON FUNCTION public.brain_command(p_workspace uuid, p_kind text, p_payload jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.brain_command_wait(p_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_preview(token text) FROM anon;

-- Policies are named <table>_<role>_<action>.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'workspace_api_keys_app_be_delete') THEN
        ALTER POLICY workspace_api_keys_app_be_delete ON public.api_keys RENAME TO api_keys_app_be_delete;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'workspace_api_keys_app_be_insert') THEN
        ALTER POLICY workspace_api_keys_app_be_insert ON public.api_keys RENAME TO api_keys_app_be_insert;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'workspace_api_keys_app_be_select') THEN
        ALTER POLICY workspace_api_keys_app_be_select ON public.api_keys RENAME TO api_keys_app_be_select;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'workspace_api_keys_app_be_update') THEN
        ALTER POLICY workspace_api_keys_app_be_update ON public.api_keys RENAME TO api_keys_app_be_update;
    END IF;
END
$$;

-- storage.objects belongs to the storage admin, so its policies cannot be renamed: each is dropped and created under its new name.
DROP POLICY IF EXISTS hiring_cv_manager_delete ON storage.objects;
DROP POLICY IF EXISTS objects_hiring_cv_manager_delete ON storage.objects;
CREATE POLICY objects_hiring_cv_manager_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'hiring'::text) AND public.storage_ws_manager(name)));
DROP POLICY IF EXISTS hiring_cv_manager_read ON storage.objects;
DROP POLICY IF EXISTS objects_hiring_cv_manager_select ON storage.objects;
CREATE POLICY objects_hiring_cv_manager_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'hiring'::text) AND public.storage_ws_manager(name)));
DROP POLICY IF EXISTS knowledge_uploads_manager_insert ON storage.objects;
DROP POLICY IF EXISTS objects_knowledge_uploads_manager_insert ON storage.objects;
CREATE POLICY objects_knowledge_uploads_manager_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'knowledge-uploads'::text) AND public.storage_ws_manager(name)));
DROP POLICY IF EXISTS media_manager_delete ON storage.objects;
DROP POLICY IF EXISTS objects_media_manager_delete ON storage.objects;
CREATE POLICY objects_media_manager_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'media'::text) AND public.storage_ws_manager(name)));
DROP POLICY IF EXISTS media_member_insert ON storage.objects;
DROP POLICY IF EXISTS objects_media_member_insert ON storage.objects;
CREATE POLICY objects_media_member_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'media'::text) AND public.storage_ws_member(name)));
DROP POLICY IF EXISTS media_member_read ON storage.objects;
DROP POLICY IF EXISTS objects_media_member_select ON storage.objects;
CREATE POLICY objects_media_member_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'media'::text) AND public.storage_ws_member(name)));
DROP POLICY IF EXISTS videos_manager_delete ON storage.objects;
DROP POLICY IF EXISTS objects_videos_manager_delete ON storage.objects;
CREATE POLICY objects_videos_manager_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'videos'::text) AND public.storage_ws_manager(name)));
DROP POLICY IF EXISTS videos_member_read ON storage.objects;
DROP POLICY IF EXISTS objects_videos_member_select ON storage.objects;
CREATE POLICY objects_videos_member_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'videos'::text) AND public.storage_ws_member(name)));

-- The back end's lead_actions policies name the row they admit instead of (true).
ALTER POLICY lead_actions_app_be_delete ON public.lead_actions USING ((workspace_id IS NOT NULL));
ALTER POLICY lead_actions_app_be_insert ON public.lead_actions WITH CHECK ((workspace_id IS NOT NULL));
ALTER POLICY lead_actions_app_be_select ON public.lead_actions USING ((workspace_id IS NOT NULL));
ALTER POLICY lead_actions_app_be_update ON public.lead_actions USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

-- job_read without the #variable_conflict directive (the ON CONFLICT target names the primary key) and with RETURN QUERY.
CREATE OR REPLACE FUNCTION public.job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer DEFAULT 2) RETURNS TABLE(msg_id bigint, attempt integer, enqueued_at timestamp with time zone, message jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  r record;
  v_ws uuid;
  v_ws_text text;
  v_busy int;
  v_attempt int;
begin
  for r in select * from pgmq.read(p_queue, greatest(5, p_vt), greatest(1, least(p_qty, 100))) loop
    v_ws_text := r.message->'payload'->>'workspaceId';
    v_ws := case when v_ws_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_ws_text::uuid end;
    if v_ws is not null then
      perform pg_advisory_xact_lock(hashtextextended('nivo.job-ws:' || v_ws::text, 0));
      delete from public.job_slots s where s.workspace_id = v_ws and s.lease_until < now();
      select count(*) into v_busy from public.job_slots s where s.workspace_id = v_ws and not (s.queue = p_queue and s.msg_id = r.msg_id);
      if v_busy >= greatest(1, p_ws_limit) then
        perform pgmq.set_vt(p_queue, r.msg_id, 3 + floor(random() * 2)::int);
        continue;
      end if;
      insert into public.job_slots as s (queue, msg_id, workspace_id, lease_until)
      values (p_queue, r.msg_id, v_ws, now() + make_interval(secs => greatest(5, p_vt)))
      on conflict on constraint job_slots_pkey do update set lease_until = excluded.lease_until;
    end if;
    v_attempt := null;
    update public.job_outbox o set attempts = o.attempts + 1, state = 'running', started_at = now()
     where o.queue = p_queue and o.msg_id = r.msg_id
    returning o.attempts into v_attempt;
    return query select r.msg_id, coalesce(v_attempt, r.read_ct), r.enqueued_at, r.message;
  end loop;
end $_$;

REVOKE EXECUTE ON FUNCTION public.job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer) TO app_be;
