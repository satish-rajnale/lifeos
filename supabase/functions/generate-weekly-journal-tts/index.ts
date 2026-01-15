import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const GOOGLE_TTS_API_KEY = Deno.env.get('GOOGLE_TTS_API_KEY')!

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DailySummary {
  date: string
  day_summary: string
  what_was_done: string[]
  energy_level: string
  emotional_tone: string
  reflection: string
}

/**
 * Fetch journal entries for the past 7 days
 * Gets the latest active summary for each day
 */
async function fetchWeeklyJournalSummaries(
  supabase: any,
  userId: string,
  endDate: string
): Promise<DailySummary[]> {
  // Calculate date 7 days ago
  const end = new Date(endDate)
  const start = new Date(end)
  start.setDate(start.getDate() - 6) // 7 days including today
  
  const startDateStr = start.toISOString().split('T')[0]
  const endDateStr = end.toISOString().split('T')[0]

  console.log(`Fetching summaries from ${startDateStr} to ${endDateStr}`)

  // Fetch all journal entries for the past 7 days
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, date, summary')
    .eq('user_id', userId)
    .gte('date', startDateStr)
    .lte('date', endDateStr)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching journal entries:', error)
    throw new Error(`Failed to fetch journal entries: ${error.message}`)
  }

  if (!entries || entries.length === 0) {
    return []
  }

  console.log(`Found ${entries.length} journal entries`)

  // Transform entries to daily summaries
  const summaries: DailySummary[] = entries.map((entry: any) => ({
    date: entry.date,
    day_summary: entry.summary.day_summary || '',
    what_was_done: entry.summary.what_was_done || [],
    energy_level: entry.summary.energy_level || 'unclear',
    emotional_tone: entry.summary.emotional_tone || 'neutral',
    reflection: entry.summary.reflection || '',
  }))

  return summaries
}

/**
 * Generate weekly reflection using OpenAI
 * Analyzes the week's patterns, achievements, and overall trends
 */
async function generateWeeklyReflection(summaries: DailySummary[]): Promise<{ text: string; stats: any }> {
  // Prepare the weekly data in a structured format
  const weeklyData = summaries.map((s, index) => {
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const date = new Date(s.date)
    const day = dayOfWeek[date.getDay()]
    
    return `**${day} (${s.date})**
Summary: ${s.day_summary}
Activities: ${s.what_was_done.join(', ')}
Energy: ${s.energy_level}
Mood: ${s.emotional_tone}
Reflection: ${s.reflection}`
  }).join('\n\n')

  const systemPrompt = `You are a warm, insightful personal assistant creating a spoken weekly reflection for your user. 

Your role:
- Speak as a real person, using "you" and "your"
- Sound like a thoughtful friend reviewing the week together
- Be conversational, encouraging, and observant
- Notice patterns, growth, and achievements
- Highlight energy trends and emotional shifts
- Celebrate wins (big and small)
- Acknowledge challenges with empathy
- Keep it natural for text-to-speech narration (1-2 minutes spoken)

Style:
- Use a warm, conversational tone
- Speak in complete, flowing sentences
- Avoid bullet points, markdown, or technical language
- Sound human, not robotic
- Target 200-350 words for comfortable listening`

  const userPrompt = `Here are the journal entries from the past week. Create a warm, spoken weekly reflection that sounds like a personal assistant talking to the user:

${weeklyData}

Generate a natural spoken reflection covering:
1. Overall week overview (how did the week flow?)
2. Key activities and achievements
3. Energy and mood patterns
4. Special moments or insights
5. A warm closing thought

Then provide stats in this exact JSON format:
{
  "reflection_text": "your warm, conversational weekly reflection here...",
  "stats": {
    "days_journaled": ${summaries.length},
    "avg_energy_level": "calculate from: low=1, medium=2, high=3, unclear=null",
    "dominant_mood": "most common emotional_tone",
    "top_activities": ["array of most mentioned activities"],
    "key_achievement": "one notable accomplishment from the week"
  }
}`

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
      temperature: 0.8, // More creative for conversational tone
      max_tokens: 800,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenAI API error:', error)
    throw new Error(`OpenAI API failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('OpenAI returned empty response')
  }

  // Parse the JSON response
  let parsed
  try {
    // Remove markdown code blocks if present
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    parsed = JSON.parse(cleaned)
  } catch (e) {
    // Fallback: try to extract JSON from the text
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('Failed to parse OpenAI response as JSON')
    }
  }

  console.log('Generated reflection:', parsed.reflection_text.substring(0, 100) + '...')
  console.log('Stats:', JSON.stringify(parsed.stats))

  return {
    text: parsed.reflection_text,
    stats: parsed.stats,
  }
}

/**
 * Generate audio using Google Cloud Text-to-Speech
 * Uses a warm, natural voice optimized for personal reflections
 */
async function generateTTSWithGoogle(text: string): Promise<Uint8Array> {
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Neural2-F', // Warm, friendly female voice
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.92, // Slightly slower for reflection
          pitch: 0.5, // Slightly higher for warmth
          volumeGainDb: 0.0,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Google TTS API error:', error)
    throw new Error(`Google TTS API failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  const audioContent = data.audioContent

  if (!audioContent) {
    throw new Error('Google TTS returned no audio content')
  }

  // Decode base64 to binary
  const binaryString = atob(audioContent)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  console.log('Generated audio size:', bytes.length, 'bytes')
  return bytes
}

/**
 * Upload audio file to Supabase Storage
 */
async function uploadWeeklyAudioToSupabase(
  supabase: any,
  userId: string,
  weekStartDate: string,
  audioData: Uint8Array
): Promise<string> {
  const path = `${userId}/${weekStartDate}/weekly-summary.mp3`

  // Delete existing file if present
  await supabase.storage.from('journal-weekly-tts').remove([path])

  // Upload new file
  const { data, error } = await supabase.storage
    .from('journal-weekly-tts')
    .upload(path, audioData, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (error) {
    console.error('Storage upload error:', error)
    throw new Error(`Failed to upload audio: ${error.message}`)
  }

  console.log('Audio uploaded to:', path)
  return path
}

/**
 * Store weekly summary in database
 */
async function storeWeeklySummary(
  supabase: any,
  userId: string,
  weekStartDate: string,
  weekEndDate: string,
  summaryText: string,
  audioPath: string,
  stats: any
): Promise<void> {
  const { error } = await supabase
    .from('journal_weekly_summaries')
    .upsert(
      {
        user_id: userId,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        summary_text: summaryText,
        tts_audio_path: audioPath,
        stats: stats,
      },
      {
        onConflict: 'user_id,week_start_date',
      }
    )

  if (error) {
    console.error('Error storing weekly summary:', error)
    throw new Error(`Failed to store weekly summary: ${error.message}`)
  }

  console.log('Weekly summary stored for:', weekStartDate, 'to', weekEndDate)
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
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body (optional endDate, defaults to today)
    const body = await req.json().catch(() => ({}))
    const endDate = body.end_date || new Date().toISOString().split('T')[0]

    console.log(`Generating weekly TTS for user ${user.id} ending on ${endDate}`)

    // Step 1: Fetch weekly journal summaries (past 7 days)
    const summaries = await fetchWeeklyJournalSummaries(supabase, user.id, endDate)

    if (summaries.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'empty',
          message: 'No journal entries found for the past week',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${summaries.length} days of journal entries`)

    // Calculate week start date
    const end = new Date(endDate)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    const weekStartDate = start.toISOString().split('T')[0]

    // Step 2: Generate weekly reflection with OpenAI
    const { text: reflectionText, stats } = await generateWeeklyReflection(summaries)

    // Step 3: Generate TTS audio with Google
    const audioData = await generateTTSWithGoogle(reflectionText)

    // Step 4: Upload audio to Supabase Storage
    const audioPath = await uploadWeeklyAudioToSupabase(supabase, user.id, weekStartDate, audioData)

    // Step 5: Store weekly summary in database
    await storeWeeklySummary(supabase, user.id, weekStartDate, endDate, reflectionText, audioPath, stats)

    // Step 6: Return success response
    return new Response(
      JSON.stringify({
        status: 'success',
        summary_text: reflectionText,
        audio_path: audioPath,
        week_start_date: weekStartDate,
        week_end_date: endDate,
        stats: stats,
        days_included: summaries.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
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
