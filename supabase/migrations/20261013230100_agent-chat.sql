-- The agent chat (test conversation and the simulated website customer) without the service role or a call to the back end.
-- Each function is called by a Server Action over the signed-in user, checks the caller belongs to the workspace of the conversation,
-- writes the message in the same transaction as the job, and puts the chat turn on the `chat_turn` queue; the back end answers (or delivers
-- a staff reply) and the answer appears on agent_messages, which the page follows through Realtime.
--   agent_chat_start(agent, kind, visitor)   opens a conversation and stores the agent greeting
--   agent_chat_send(conversation, body)      stores the message: the customer's (answered by the back end) or, while a person holds a
--                                            customer conversation, the person's own reply (delivered by the back end)
--   agent_chat_take_over(conversation, take, line)  a person takes the conversation over (the AI goes quiet) or hands it back

create or replace function public.agent_chat_start(p_agent uuid, p_kind text, p_visitor text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace uuid;
    v_greeting text;
    v_conversation uuid;
    v_visitor text := nullif(left(btrim(coalesce(p_visitor, '')), 80), '');
begin
    if p_kind is null or p_kind not in ('test', 'customer') then
        raise exception 'agent_chat_kind' using errcode = '23514';
    end if;
    select workspace_id, greeting into v_workspace, v_greeting from public.agents where id = p_agent;
    if v_workspace is null or not public.is_member(v_workspace) then
        raise exception 'only a member of the workspace opens a conversation' using errcode = '42501';
    end if;
    if p_kind = 'test' and v_visitor is null then
        select display_name into v_visitor from public.workspace_members
        where workspace_id = v_workspace and user_id = auth.uid() and status = 'active';
    end if;
    insert into public.agent_conversations (workspace_id, agent_id, kind, visitor_name)
    values (v_workspace, p_agent, p_kind, v_visitor)
    returning id into v_conversation;
    if coalesce(v_greeting, '') <> '' then
        insert into public.agent_messages (workspace_id, conversation_id, role, body)
        values (v_workspace, v_conversation, 'agent', v_greeting);
    end if;
    return v_conversation;
end $$;

create or replace function public.agent_chat_send(p_conversation uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace uuid;
    v_kind text;
    v_holder text;
    v_body text := btrim(coalesce(p_body, ''));
    v_name text;
    v_message uuid;
    v_by_person boolean;
begin
    if v_body = '' or length(v_body) > 4000 then
        raise exception 'agent_chat_body' using errcode = '23514';
    end if;
    select workspace_id, kind, handled_by into v_workspace, v_kind, v_holder from public.agent_conversations where id = p_conversation;
    if v_workspace is null or not public.is_member(v_workspace) then
        raise exception 'only a member of the workspace writes in a conversation' using errcode = '42501';
    end if;
    -- While a person holds a customer conversation the AI stays quiet and the member writes as the company.
    v_by_person := v_kind = 'customer' and v_holder is not null;
    if v_by_person then
        select display_name into v_name from public.workspace_members
        where workspace_id = v_workspace and user_id = auth.uid() and status = 'active';
        insert into public.agent_messages (workspace_id, conversation_id, role, body, author_kind, author_name)
        values (v_workspace, p_conversation, 'agent', v_body, 'human', v_name)
        returning id into v_message;
    else
        insert into public.agent_messages (workspace_id, conversation_id, role, body)
        values (v_workspace, p_conversation, 'user', v_body)
        returning id into v_message;
    end if;
    perform public.job_enqueue(
        v_workspace,
        'chat_turn',
        case when v_by_person then 'chat-turn.deliver' else 'chat-turn.turn' end,
        jsonb_build_object(
            'kind', case when v_by_person then 'deliver' else 'turn' end,
            'workspaceId', v_workspace,
            'conversationId', p_conversation,
            'messageId', v_message,
            'channelEventId', 'agentchat:' || v_message,
            'lookupName', false
        ),
        case when v_by_person then 'chat-turn.deliver:' else 'chat-turn.turn:' end || v_message
    );
    return v_message;
end $$;

create or replace function public.agent_chat_take_over(p_conversation uuid, p_take boolean, p_line text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace uuid;
    v_name text;
    v_holder text;
begin
    select workspace_id into v_workspace from public.agent_conversations where id = p_conversation;
    if v_workspace is null or not public.is_member(v_workspace) then
        raise exception 'only a member of the workspace takes a conversation over' using errcode = '42501';
    end if;
    select display_name into v_name from public.workspace_members
    where workspace_id = v_workspace and user_id = auth.uid() and status = 'active';
    v_holder := case when p_take then coalesce(v_name, 'staff') else null end;
    update public.agent_conversations
    set handled_by = v_holder, handled_at = case when p_take then now() else null end
    where id = p_conversation;
    if btrim(coalesce(p_line, '')) <> '' then
        insert into public.agent_messages (workspace_id, conversation_id, role, body)
        values (v_workspace, p_conversation, 'system', replace(left(p_line, 400), '{user}', coalesce(v_name, '')));
    end if;
    return coalesce(v_holder, '');
end $$;

revoke execute on function public.agent_chat_start(uuid, text, text) from public, anon;
revoke execute on function public.agent_chat_send(uuid, text) from public, anon;
revoke execute on function public.agent_chat_take_over(uuid, boolean, text) from public, anon;
grant execute on function public.agent_chat_start(uuid, text, text) to authenticated;
grant execute on function public.agent_chat_send(uuid, text) to authenticated;
grant execute on function public.agent_chat_take_over(uuid, boolean, text) to authenticated;
