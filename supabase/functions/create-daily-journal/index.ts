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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // Check credits
    const { data: credits, error: creditError } = await supabaseClient
      .from('usage_credits')
      .select('daily_journal_credits')
      .eq('user_id', user.id)
      .single()

    if (creditError || !credits || credits.daily_journal_credits <= 0) {
       return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { text, date } = await req.json()

    // OpenAI Call
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
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

    const openAiJson = await openAiResponse.json()
    const content = openAiJson.choices?.[0]?.message?.content
    if (!content) throw new Error('Failed to get response from OpenAI');

    let parsedJournal
    try {
        parsedJournal = JSON.parse(content)
    } catch (e) {
        // Fallback if model includes markdown code blocks
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '')
        parsedJournal = JSON.parse(cleaned)
    }

    // Insert Journal (Credits decremented by trigger)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: insertError } = await supabaseAdmin
      .from('journal_entries')
      .insert({
        user_id: user.id,
        journal_date: date,
        raw_transcript: text,
        summary: parsedJournal
      })

    if (insertError) throw insertError;

    return new Response(JSON.stringify(parsedJournal), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
