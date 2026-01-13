import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[EDGE_START] create-daily-journal function invoked')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('[ENV_CHECK]', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      hasOpenAiKey: !!openAiKey,
      hasServiceRoleKey: !!serviceRoleKey
    })
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    if (!openAiKey) {
      throw new Error('Missing OpenAI API key')
    }
    
    if (!serviceRoleKey) {
      throw new Error('Missing Supabase Service Role key')
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    console.log('[AUTH_CHECK] Verifying user authentication')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError) {
      console.error('[AUTH_ERROR]', userError)
      throw new Error(`Authentication failed: ${userError.message}`)
    }
    
    if (!user) {
      throw new Error('No authenticated user found')
    }
    
    console.log('[AUTH_SUCCESS] User authenticated:', user.id)

    // Check credits
    console.log('[CREDIT_CHECK] Checking user credits')
    const { data: credits, error: creditError } = await supabaseClient
      .from('usage_credits')
      .select('daily_journal_credits')
      .eq('user_id', user.id)
      .single()

    if (creditError) {
      console.error('[CREDIT_ERROR]', creditError)
      return new Response(JSON.stringify({ error: `Credit check failed: ${creditError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (!credits || credits.daily_journal_credits <= 0) {
      console.log('[CREDIT_INSUFFICIENT] User has no credits')
      return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    
    console.log('[CREDIT_OK] User has credits:', credits.daily_journal_credits)

    const { text, date } = await req.json()
    console.log('[REQUEST_DATA]', { textLength: text?.length || 0, date })

    // OpenAI Call
    console.log('[OPENAI_START] Calling OpenAI API')
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a reflective journal summarizer.

You do NOT give advice.
You do NOT judge.
You do NOT motivate.
You do NOT analyze psychology.

Your role is to turn a daily spoken reflection into a calm, factual journal page.`
          },
          {
            role: 'user',
            content: `Transform the following daily reflection into a structured daily journal entry.

RULES:
- Keep tone neutral, reflective, and calm
- Do NOT add advice or suggestions
- Do NOT add motivational language
- Do NOT invent details
- Focus on what was done or experienced at a high level
- Avoid work-specific technical detail
- Write as if the user is reading their own journal later

OUTPUT FORMAT (JSON ONLY):
{
  "day_summary": "2–3 sentences summarizing the day",
  "what_was_done": [
    "High-level actions or events (3–6 bullets max)"
  ],
  "energy_level": "low | medium | high | unclear",
  "emotional_tone": "neutral | heavy | positive | mixed",
  "reflection": "1–2 calm sentences capturing the essence of the day"
}

INPUT:
"""
${text}
"""`
          }
        ],
        temperature: 0.2,
        max_tokens: 300
      })
    })

    console.log('[OPENAI_RESPONSE] Status:', openAiResponse.status)
    
    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text()
      console.error('[OPENAI_ERROR]', errorText)
      throw new Error(`OpenAI API error: ${openAiResponse.status} - ${errorText}`)
    }

    const openAiJson = await openAiResponse.json()
    const content = openAiJson.choices?.[0]?.message?.content
    
    if (!content) {
      console.error('[OPENAI_NO_CONTENT]', JSON.stringify(openAiJson, null, 2))
      throw new Error('Failed to get response from OpenAI')
    }
    
    console.log('[OPENAI_SUCCESS] Received content:', content.substring(0, 100) + '...')

    let parsedJournal
    try {
        console.log('[PARSE_START] Parsing OpenAI response')
        parsedJournal = JSON.parse(content)
    } catch (e) {
        console.log('[PARSE_FALLBACK] Trying fallback parsing (removing markdown)')
        // Fallback if model includes markdown code blocks
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim()
        try {
          parsedJournal = JSON.parse(cleaned)
        } catch (e2) {
          console.error('[PARSE_ERROR] Failed to parse:', content)
          throw new Error(`Failed to parse OpenAI response: ${e2.message}`)
        }
    }
    
    console.log('[PARSE_SUCCESS] Parsed journal entry')

    // Insert Journal (Credits decremented by trigger)
    console.log('[DB_INSERT] Creating admin client and inserting journal')
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    )

    const { error: insertError } = await supabaseAdmin
      .from('journal_entries')
      .insert({
        user_id: user.id,
        journal_date: date,
        raw_transcript: text,
        summary: parsedJournal
      })

    if (insertError) {
      console.error('[DB_ERROR]', insertError)
      throw new Error(`Database insert failed: ${insertError.message}`)
    }
    
    console.log('[DB_SUCCESS] Journal entry created')
    console.log('[EDGE_COMPLETE] Function completed successfully')

    return new Response(JSON.stringify(parsedJournal), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('[EDGE_ERROR] Function failed:', err.message)
    console.error('[EDGE_ERROR_STACK]', err.stack)
    return new Response(JSON.stringify({ 
      error: err.message,
      details: err.toString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
