import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify user's role
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth
      .getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const userRole = user.app_metadata?.role;
    if (userRole !== "master") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: Only master users can update roles",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // Parse request body
    const { userId, newRole } = await req.json();

    if (!userId || !newRole) {
      return new Response(
        JSON.stringify({ error: "Missing userId or newRole" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // 1) Auth app_metadata.role — 권한/RLS의 진짜 기준
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { app_metadata: { role: newRole } },
    );

    if (error) {
      console.error("Error updating user role:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 2) user_profiles.role 동기화 — list-users가 profileInfo.role을 우선 표시하므로
    //    이걸 안 바꾸면 역할 변경이 화면에 반영되지 않는다.
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (profileError) {
      console.error("Error syncing user_profiles.role:", profileError);
      return new Response(JSON.stringify({ error: profileError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 감사 로그 기록 (성공 분기). 실패해도 본 작업은 성공 처리 — 기록 누락만.
    try {
      await supabaseAdmin.from("audit_log").insert({
        actor_id: user.id,
        actor_name: user.user_metadata?.name ?? "system",
        actor_role: user.app_metadata?.role ?? null,
        action: "role_change",
        target_table: "user_auth",
        target_id: userId,
        after: { role: newRole },
        summary: `${user.user_metadata?.name ?? "관리자"} 가 사용자(${userId}) 역할을 ${newRole} (으)로 변경`,
      });
    } catch (auditErr) {
      console.error("audit_log insert failed (role_change):", auditErr);
    }

    return new Response(
      JSON.stringify({ message: "User role updated successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
