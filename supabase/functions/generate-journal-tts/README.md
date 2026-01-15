# Generate Journal TTS Edge Function

This Supabase Edge Function generates AI-summarized audio narrations of daily journal entries.

## Features

- Fetches all journal entries for a specific date
- Combines entries chronologically
- Summarizes using OpenAI (GPT-4o-mini) with TTS-optimized prompts
- Generates natural audio using Google Cloud Text-to-Speech
- Stores audio in Supabase Storage
- Saves summary metadata in database

## API Endpoints

### POST `/generate-journal-tts`

**Request:**
```json
{
  "date": "2024-01-14"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "summary_text": "Looking back on today, I worked on...",
  "audio_path": "user-id/2024-01-14/summary.mp3",
  "date": "2024-01-14"
}
```

**Response (Empty):**
```json
{
  "status": "empty",
  "message": "No journal entries found for this date"
}
```

**Response (Error):**
```json
{
  "status": "error",
  "error": "Error message"
}
```

## Setup

### 1. Apply Database Migration

```bash
supabase db push
```

Or run `migrations/007_journal_daily_summaries.sql` in Supabase SQL Editor.

### 2. Set Environment Variables

In Supabase Dashboard → Edge Functions → Secrets:

```bash
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_TTS_API_KEY=your-google-cloud-api-key
```

(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected)

### 3. Get API Keys

**OpenAI:**
- Go to https://platform.openai.com/api-keys
- Create new key with GPT-4 access

**Google Cloud TTS:**
- Go to https://console.cloud.google.com
- Enable "Cloud Text-to-Speech API"
- Create API key in Credentials

### 4. Deploy Function

```bash
supabase functions deploy generate-journal-tts
```

## Testing

### From Client App:

```typescript
import { generateJournalTTS } from '@/services/supabase/edge-functions/generateJournalTTS'

const result = await generateJournalTTS('2024-01-14')

if (result.status === 'success') {
  console.log('Summary:', result.summary_text)
  console.log('Audio:', result.audio_path)
}
```

### Using curl:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-journal-tts \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-14"}'
```

## Storage Structure

```
journal-tts/
  └── {user_id}/
      └── {YYYY-MM-DD}/
          └── summary.mp3
```

## Database Schema

**journal_daily_summaries:**
- `id`: UUID (primary key)
- `user_id`: UUID (references auth.users)
- `date`: DATE
- `summary_text`: TEXT
- `tts_audio_path`: TEXT
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

## Voice Configuration

Current voice: **en-US-Neural2-J** (Natural female voice)

To change voice, modify in `index.ts`:

```typescript
voice: {
  languageCode: 'en-US',
  name: 'en-US-Neural2-J', // Change this
  ssmlGender: 'NEUTRAL',
}
```

Available voices: https://cloud.google.com/text-to-speech/docs/voices

## Error Handling

The function handles:
- Missing authentication
- Empty journal days
- OpenAI API failures
- Google TTS API failures
- Storage upload errors
- Database errors

All errors return proper HTTP status codes and error messages.

## Performance

- Average execution time: 5-10 seconds
- OpenAI: ~2-3 seconds
- Google TTS: ~2-3 seconds
- Storage upload: ~1 second
- Summary length: 150-300 words (1-2 minutes audio)

## Costs

**OpenAI GPT-4o-mini:**
- ~$0.0001 per summary

**Google Cloud TTS:**
- First 4 million characters/month: Free
- After: $4 per 1 million characters

**Supabase Storage:**
- Included in plan
- ~50-100 KB per audio file
