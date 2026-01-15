import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') || 'your-webhook-secret-key'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface JournalEntry {
  id: string
  user_id: string
  date: string
  raw_transcript: string
}

/**
 * Generate summary using OpenAI
 */
async function generateSummary(rawTranscript: string): Promise<any> {
  const systemPrompt = `You are a reflective journal summarizer.

You do NOT give advice.
You do NOT judge.
You do NOT motivate.
You do NOT analyze psychology.

Your role is to turn a daily spoken reflection into a calm, factual journal page.`

  const userPrompt = `Transform the following daily reflection into a structured daily journal entry.

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
${rawTranscript}
"""`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenAI API error:', error)
    throw new Error(`OpenAI API failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Failed to get response from OpenAI')
  }

  // Parse JSON response
  let parsedSummary
  try {
    parsedSummary = JSON.parse(content)
  } catch (e) {
    // Fallback if model includes markdown code blocks
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '')
    parsedSummary = JSON.parse(cleaned)
  }

  console.log('Generated summary:', JSON.stringify(parsedSummary).substring(0, 100) + '...')
  return parsedSummary
}

/**
 * Update journal entry with generated summary
 */
async function updateJournalEntry(
  supabase: any,
  entryId: string,
  summary: any
): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .update({
      summary: summary,
      is_summarized: true,
    })
    .eq('id', entryId)

  if (error) {
    console.error('Error updating journal entry:', error)
    throw new Error(`Failed to update journal entry: ${error.message}`)
  }

  console.log('Journal entry updated:', entryId)
}

/**
 * Decrement user credits
 */
async function decrementCredits(supabase: any, userId: string): Promise<void> {
  const { error } = await supabase
    .from('usage_credits')
    .update({
      daily_journal_credits: supabase.rpc('decrement', { x: 1 }),
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Error decrementing credits:', error)
    // Don't throw - this is non-critical
  } else {
    console.log('Credits decremented for user:', userId)
  }
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook secret for security
    const webhookSecret = req.headers.get('x-webhook-secret')
    if (webhookSecret !== WEBHOOK_SECRET) {
      console.error('Invalid webhook secret')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Parse webhook payload
    const payload = await req.json()
    console.log('Received webhook payload:', payload)

    // Extract journal entry data
    const { type, table, record, old_record } = payload

    // Handle different webhook types
    if (type === 'INSERT' && table === 'journal_entries') {
      const entry: JournalEntry = record

      // Check if entry needs summarization
      if (!entry.raw_transcript || record.is_summarized) {
        console.log('Entry already summarized or missing transcript, skipping')
        return new Response(
          JSON.stringify({ status: 'skipped', message: 'Entry already summarized' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Processing journal entry ${entry.id} for user ${entry.user_id}`)

      // Step 1: Check user credits
      const { data: credits } = await supabase
        .from('usage_credits')
        .select('daily_journal_credits')
        .eq('user_id', entry.user_id)
        .single()

      if (!credits || credits.daily_journal_credits <= 0) {
        console.error('Insufficient credits for user:', entry.user_id)
        return new Response(
          JSON.stringify({ error: 'Insufficient credits' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Step 2: Generate summary with OpenAI
      const summary = await generateSummary(entry.raw_transcript)

      // Step 3: Update journal entry with summary
      await updateJournalEntry(supabase, entry.id, summary)

      // Step 4: Decrement credits (non-blocking)
      await decrementCredits(supabase, entry.user_id)

      return new Response(
        JSON.stringify({
          status: 'success',
          entry_id: entry.id,
          summary: summary,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Unsupported webhook type
    return new Response(
      JSON.stringify({ status: 'ignored', message: 'Unsupported webhook type' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
