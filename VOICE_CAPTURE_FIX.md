# Voice Capture and Permission Handling

## Issues Fixed

### 1. "Client side error" on Voice Capture
**Error:** `[VOICE_ERROR] {"message": "Client side error"}`

**Root Cause:**
- The Android SpeechRecognizer was not checking for microphone permissions before starting
- Generic error messages made debugging difficult
- Permissions weren't requested proactively

**Solutions Applied:**
1. Added permission checks in Android module before starting recognition
2. Improved error messages to be user-friendly
3. Added proactive permission request on journal screen load
4. Better error handling in `useSpeechToText` hook

### 2. Missing Permission Requests
**Issue:** App didn't ask for microphone permissions until user tried to record

**Solution:**
- Permissions now requested when user lands on journal page
- Clear prompts guide user to grant access
- Graceful fallback if permissions denied

## Changes Made

### 1. DailyJournalScreen (`src/app/journal/DailyJournalScreen.tsx`)

**Added:**
- `requestPermissions()` function using platform-specific APIs:
  - **Android:** `PermissionsAndroid.request()` for RECORD_AUDIO
  - **iOS:** Permissions handled by native speech module
- Calls permission request on screen mount
- Shows alert with clear messaging if denied
- Prevents voice modal from opening without permissions (Android)
- Added "Open Settings" button to guide users

**Permission Flow:**
```typescript
useEffect(() => {
  fetchJournal(date)
  fetchCredits()
  requestPermissions() // ← Request on mount
}, [])

const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    // Request RECORD_AUDIO permission
    const granted = await PermissionsAndroid.request(...)
    setHasPermissions(granted === RESULTS.GRANTED)
  } else {
    // iOS: Native module handles permissions
    setHasPermissions(true)
  }
}

const handleOpenVoiceModal = () => {
  if (Platform.OS === 'android' && !hasPermissions) {
    Alert.alert(...) // ← Block if no permission
    return
  }
  setModalVisible(true)
}
```

### 2. Speech Hook (`src/app/voice/useSpeechToText.ts`)

**Improvements:**
- Added `getErrorMessage()` helper for user-friendly error messages
- Maps technical errors to readable messages:
  - `"PERMISSION_DENIED"` → `"Microphone access denied. Please enable it in Settings."`
  - `"Client side error"` → `"Unable to start recording. Please check microphone permissions."`
- Shows alerts for permission errors
- Better logging with formatted messages

### 3. Voice Modal (`src/app/voice/VoiceCaptureModal.tsx`)

**UI Improvements:**
- Shows error state with clear messaging in modal
- Added listening indicator (animated dots)
- Delays auto-start by 300ms for smooth animation
- Status text shows "Listening..." or "Tap to start recording"
- Better visual feedback for all states

### 4. Android Module (`modules/speech-recognition/android/.../SpeechRecognitionModule.kt`)

**Permission Handling:**
```kotlin
// Check for RECORD_AUDIO permission before starting
val hasPermission = ContextCompat.checkSelfPermission(
  activity,
  Manifest.permission.RECORD_AUDIO
) == PackageManager.PERMISSION_GRANTED

if (!hasPermission) {
  promise.reject("PERMISSION_DENIED", "Microphone permission not granted", null)
  return
}

// Check if speech recognition is available
if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
  promise.reject("NOT_AVAILABLE", "Speech recognition is not available on this device", null)
  return
}
```

**Better Error Messages:**
- `ERROR_CLIENT` → `"Microphone permission denied or unavailable."`
- `ERROR_INSUFFICIENT_PERMISSIONS` → `"Microphone permission not granted."`
- `ERROR_AUDIO` → `"Audio recording error. Please check microphone."`

## Permission Flow Diagram

```
User Opens Journal Screen
         ↓
requestPermissions() called
         ↓
   Has Permission?
    /           \
  YES            NO
   ↓             ↓
Set flag     Show Alert
   ↓             ↓
User taps    "Grant Access"
"Record"         ↓
   ↓        Request Again
Open Modal       ↓
   ↓         (to Settings)
Auto-start
Listening
```

## Testing Instructions

### 1. Test Fresh Install (No Permissions)

```bash
# Delete app and reinstall
npx expo start -c
```

**Expected behavior:**
1. User opens app and logs in
2. Lands on journal screen
3. **Alert appears:** "Microphone Permission Required"
4. User taps "Grant Access"
5. System permission dialog appears
6. User grants permission
7. User can now tap "Record Reflection"

### 2. Test Permission Denied

**Steps:**
1. On journal screen, when permission alert appears, tap "Cancel"
2. Try tapping "Record Reflection" button
3. **Expected:** Alert asks user to grant permission again

**Android:**
- Long press app → App Info → Permissions → Microphone → Allow

**iOS:**
- Settings → LifeOS → Microphone → Enable

### 3. Test Voice Recording

**With permissions granted:**
1. Tap "Record Reflection"
2. Modal opens
3. After 300ms delay, recording starts
4. Status shows "Listening..."
5. Speak: "Today I worked on my project and felt productive"
6. Tap checkmark
7. Journal entry created

### 4. Test Error States

**Airplane mode (network error):**
- Android speech recognition needs internet
- Expected: "Network error. Speech recognition needs internet."

**Microphone in use:**
- Open another app using mic
- Try recording
- Expected: "Audio recording error. Please check microphone."

## Console Logs to Watch

**Successful flow:**
```
🎤 Requesting microphone permissions...
✅ Microphone permission granted
🎤 [VOICE_START] Listening...
📝 [VOICE_PARTIAL] "Today I worked on..."
✅ [VOICE_STOP] Transcript length: 45
```

**Permission denied:**
```
🎤 Requesting microphone permissions...
❌ Microphone permission denied
❌ [VOICE_ERROR] PERMISSION_DENIED
```

**Recording error:**
```
✅ Permission granted
🎤 Starting recording...
❌ [VOICE_ERROR] Client side error → Microphone permission denied or unavailable.
```

## Permissions Required

### iOS (Info.plist)
Already configured in `ios/lifeos/Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>We need access to the microphone to record your daily journal entries.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>We need access to speech recognition to transcribe your daily journal entries.</string>
```

### Android (AndroidManifest.xml)
Already configured in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## Troubleshooting

### "Client side error" still appearing

**Check:**
1. Microphone permission granted?
   ```bash
   # Android
   adb shell pm list permissions -g | grep RECORD_AUDIO
   ```

2. Another app using microphone?
   - Close other apps that might be using the mic

3. Device has working microphone?
   - Test with device's voice recorder app

### Permission alert not showing

**iOS:**
- First permission request triggers system dialog automatically
- If dismissed, must manually enable in Settings

**Android:**
- System dialog appears on first `requestPermissionsAsync()` call
- If denied twice, marked as "Don't ask again"
- Must manually enable in Settings

### Speech recognition not working

**Android specific:**
- Requires Google app installed (for speech services)
- Needs internet connection
- Check: Settings → Apps → Google → Permissions → Microphone

**iOS specific:**
- Works offline (uses on-device Siri)
- Requires iOS 10+
- Language must be supported

## Next Steps

1. **Test on physical devices** (iOS and Android)
2. **Verify permissions** granted correctly
3. **Test voice recording** end-to-end
4. **Check journal creation** with transcribed text

## Related Files

- `src/app/journal/DailyJournalScreen.tsx` - Permission request
- `src/app/voice/useSpeechToText.ts` - Error handling
- `src/app/voice/VoiceCaptureModal.tsx` - UI feedback
- `modules/speech-recognition/android/.../SpeechRecognitionModule.kt` - Android implementation
- `modules/speech-recognition/ios/SpeechRecognitionModule.swift` - iOS implementation
