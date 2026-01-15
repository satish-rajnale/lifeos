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

/**
 * Fetch all journal entries for a user on a specific date
 */
async function fetchJournalEntries(
  supabase: any,
  userId: string,
  date: string
): Promise<{ raw_transcript: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('raw_transcript, created_at')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching journal entries:', error)
    throw new Error(`Failed to fetch journal entries: ${error.message}`)
  }

  return data || []
}

/**
 * Summarize combined journal text using OpenAI
 * Optimized for text-to-speech narration
 */
async function summarizeWithOpenAI(combinedText: string): Promise<string> {
  const systemPrompt = `You are a thoughtful journaling assistant. Transform the user's raw journal entries into a natural, spoken-style summary optimized for text-to-speech narration.

Guidelines:
- Write in first-person perspective
- Use a calm, reflective tone
- Create flowing, conversational sentences
- Target 1-2 minutes of spoken audio (150-300 words)
- Avoid bullet points, markdown, or emojis
- Focus on key themes, emotions, and experiences
- Make it sound natural when spoken aloud
- Start with a brief reflection opener like "Today was..." or "Looking back on today..."`

  const userPrompt = `Transform these journal entries into a natural spoken summary:\n\n${combinedText}`

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
      temperature: 0.7,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenAI API error:', error)
    throw new Error(`OpenAI API failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  const summary = data.choices[0]?.message?.content?.trim()

  if (!summary) {
    throw new Error('OpenAI returned empty summary')
  }

  console.log('Generated summary:', summary.substring(0, 100) + '...')
  return summary
}

/**
 * Generate audio using Google Cloud Text-to-Speech
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
          name: 'en-US-Wavenet-C', // Natural female voice
          ssmlGender: 'NEUTRAL',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.95, // Slightly slower for reflection
          pitch: 0.0,
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
async function uploadAudioToSupabase(
  supabase: any,
  userId: string,
  date: string,
  audioData: Uint8Array
): Promise<string> {
  const path = `${userId}/${date}/summary.mp3`

  // Delete existing file if present
  await supabase.storage.from('journal-tts').remove([path])

  // Upload new file
  const { data, error } = await supabase.storage
    .from('journal-tts')
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
 * Store or update journal daily summary
 */
async function storeDailySummary(
  supabase: any,
  userId: string,
  date: string,
  summaryText: string,
  audioPath: string
): Promise<void> {
  const { error } = await supabase
    .from('journal_daily_summaries')
    .upsert(
      {
        user_id: userId,
        date,
        summary_text: summaryText,
        tts_audio_path: audioPath,
      },
      {
        onConflict: 'user_id,date',
      }
    )

  if (error) {
    console.error('Error storing summary:', error)
    throw new Error(`Failed to store summary: ${error.message}`)
  }

  console.log('Summary stored for:', date)
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

    let token = authHeader.replace('Bearer ', '')
    token = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjI3YmYyYWU0LTVmOWYtNDI4Mi05MGQ1LWEzNDA1OGY1Zjg4ZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3lva2FsbGx4ZmFpeHBmampsa3VuLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlZmQ4MjIxZS02YjViLTQ0MDctODY0Yi1mY2UxZDU4MWRmOTgiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY4NDQ4ODQzLCJpYXQiOjE3Njg0NDUyNDMsImVtYWlsIjoiZGlwYWxpcmFqbmFsZThAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJnb29nbGUiLCJwcm92aWRlcnMiOlsiZ29vZ2xlIl19LCJ1c2VyX21ldGFkYXRhIjp7ImF2YXRhcl91cmwiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NKSEZZNUtTcUR5SVBzTlRZdGdlb2ZGbkNSbzRUQ3ZoemNMM0kzOFZucGVUWklQR2c9czk2LWMiLCJlbWFpbCI6ImRpcGFsaXJham5hbGU4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiJEaXBhbGkgUmFqbmFsZSIsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbSIsIm5hbWUiOiJEaXBhbGkgUmFqbmFsZSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0pIRlk1S1NxRHlJUHNOVFl0Z2VvZkZuQ1JvNFRDdmh6Y0wzSTM4Vm5wZVRaSVBHZz1zOTYtYyIsInByb3ZpZGVyX2lkIjoiMTE0NzE1NjQyMTcyMjMyMjgzMDgxIiwic3ViIjoiMTE0NzE1NjQyMTcyMjMyMjgzMDgxIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib2F1dGgiLCJ0aW1lc3RhbXAiOjE3Njg0MTU5NzV9XSwic2Vzc2lvbl9pZCI6ImNhMTE4NTZiLTc4MTgtNDIwOS1hMjZlLTI4YWFhMjkwNmVlYiIsImlzX2Fub255bW91cyI6ZmFsc2V9.Tn3GoZyJsISmW4LxC5cb4oO46MDz4PB7CYDkX8maNn7VI2BMXDgVrvpjTWB-zZvnPtB6kmEetTwrfx-kktzHyQ"
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    // const { date } = await req.json()

    const date ="2026-01-15";

    if (!date) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generating TTS for user ${user.id} on date ${date}`)

    // Step 1: Fetch journal entries
    const entries = await fetchJournalEntries(supabase, user.id, date)

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'empty',
          message: 'No journal entries found for this date',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${entries.length} journal entries`)

    // Step 2: Combine entries into single text block
    const combinedText = entries
      .map((entry) => entry.raw_transcript)
      .join('\n\n')

    if (!combinedText.trim()) {
      return new Response(
        JSON.stringify({
          status: 'empty',
          message: 'Journal entries are empty',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Summarize with OpenAI
    const summaryText = await summarizeWithOpenAI(combinedText)

    // Step 4: Generate TTS audio with Google
    const audioData = await generateTTSWithGoogle(summaryText)

    // Step 5: Upload audio to Supabase Storage
    const audioPath = await uploadAudioToSupabase(supabase, user.id, date, audioData)

    // Step 6: Store summary in database
    await storeDailySummary(supabase, user.id, date, summaryText, audioPath)

    // Step 7: Return success response
    return new Response(
      JSON.stringify({
        status: 'success',
        summary_text: summaryText,
        audio_path: audioPath,
        date,
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
