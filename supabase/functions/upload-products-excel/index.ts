import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { products: productsData } = await req.json();

    if (!productsData || !Array.isArray(productsData) || productsData.length === 0) {
      return new Response(JSON.stringify({ error: 'No product data provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 1차: 배치 upsert 시도 (빠름)
    const { data, error } = await supabaseClient
      .from('products')
      .upsert(productsData, { onConflict: 'product_code' })
      .select();

    if (!error) {
      return new Response(JSON.stringify({
        message: `${data.length}건 업로드 완료`,
        success_count: data.length,
        error_count: 0,
        errors: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2차: 배치 실패 시 개별 행 upsert로 폴백 (어떤 행이 문제인지 파악)
    console.error('Batch upsert failed, falling back to row-by-row:', error.message);
    const errors: Array<{ row_index: number; product_code: string; name: string; error: string }> = [];
    let successCount = 0;

    for (let i = 0; i < productsData.length; i++) {
      const product = productsData[i];
      const { error: rowError } = await supabaseClient
        .from('products')
        .upsert(product, { onConflict: 'product_code' });

      if (rowError) {
        errors.push({
          row_index: i,
          product_code: product.product_code || '',
          name: product.name || '',
          error: rowError.message,
        });
      } else {
        successCount++;
      }
    }

    const totalCount = productsData.length;
    return new Response(JSON.stringify({
      message: `${totalCount}건 중 ${successCount}건 성공, ${errors.length}건 실패`,
      success_count: successCount,
      error_count: errors.length,
      errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
