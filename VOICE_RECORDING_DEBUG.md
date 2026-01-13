# Voice Recording Debug Guide

## Changes Made

### 1. Added .gitignore File
Created a comprehensive `.gitignore` file for the React Native/Expo project that excludes:
- Node modules
- Build artifacts (iOS/Android)
- Environment files
- IDE configuration files
- Expo build folders
- OS-specific files

### 2. Enhanced Logging System

#### Logger Service (`src/services/logger.ts`)
- Added new log event types for voice capture
- Added timestamps to all log messages
- Added `warn` method for warnings
- Improved log formatting with JSON pretty-print

#### JavaScript Module Wrapper (`modules/speech-recognition/index.ts`)
- Added comprehensive logging at the JS bridge level
- Logs all method calls (checkPermission, startListening, stopListening)
- Logs all events (onPartialResult, onError)
- Tracks transcript length and state

#### React Hook (`src/app/voice/useSpeechToText.ts`)
- Added logging for permission checks
- Added logging for start/stop operations
- Added detailed error logging with stack traces
- Added logging for partial results with text preview
- Logs platform-specific behavior

#### UI Component (`src/app/voice/VoiceCaptureModal.tsx`)
- Added logging for modal state changes
- Added logging for transcript updates
- Added logging for error states
- Added logging for user interactions (done button)
- Tracks processing state

### 3. Native Module Enhancements

#### iOS Module (`modules/speech-recognition/ios/SpeechRecognitionModule.swift`)
- **Added `checkPermission` function** (was missing before)
- Added NSLog statements throughout the module
- Logs authorization status
- Logs audio session setup
- Logs recognition task lifecycle
- Logs partial results with metadata
- Logs audio format information
- Filters out error code 216 (intentional cancellation)

#### Android Module (`modules/speech-recognition/android/src/main/java/expo/modules/speechrecognition/SpeechRecognitionModule.kt`)
- Added comprehensive android.util.Log statements
- Logs permission checks
- Logs recognition availability
- Logs all RecognitionListener callbacks
- Logs audio levels (RMS changes)
- Logs buffer reception
- Logs partial and final results
- Logs errors with detailed information

## How to Test

### 1. Run the App
```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

### 2. Open the Voice Recording Modal
- Navigate to the journal or relevant screen
- Tap the microphone/record button to open the voice capture modal

### 3. Monitor the Logs

#### For iOS (Xcode Console):
```bash
# Watch for logs with these prefixes:
[VOICE_PERMISSION_CHECK]
[VOICE_NATIVE_START]
[VOICE_PARTIAL]
[VOICE_AUDIO]
[VOICE_NATIVE_STOP]
[VOICE_ERROR]
```

#### For Android (Logcat):
```bash
# Filter by SpeechRecognition tag
adb logcat | grep SpeechRecognition

# Or view all voice-related logs
adb logcat | grep "\[VOICE"
```

#### For React Native (Metro Bundler):
All JavaScript-level logs will appear in the Metro bundler console with timestamps.

### 4. What to Look For

#### Normal Flow (Success Case):
1. `[VOICE_PERMISSION_CHECK]` - Permission checks on mount
2. `[VOICE_START]` - Modal opened
3. `[VOICE_NATIVE_START]` - Native method called
4. `[VOICE_NATIVE_START]` - Audio engine/recognizer started
5. `[VOICE_AUDIO]` - Audio buffers being received (Android only)
6. `[VOICE_PARTIAL]` - Real-time transcription as you speak
7. `[VOICE_NATIVE_STOP]` - When done button is pressed
8. `[VOICE_STOP]` - Final transcript captured

#### Problem Indicators:

**No Audio Being Captured:**
- Missing `[VOICE_AUDIO]` logs on Android
- Missing `[VOICE_PARTIAL]` logs
- Check for `[VOICE_ERROR]` messages

**Permission Issues:**
- `[VOICE_ERROR]` with "PERMISSION_DENIED"
- `[VOICE_PERMISSION_CHECK]` showing `hasPermission = false`

**Recognition Not Starting:**
- `[VOICE_NATIVE_START]` present but no subsequent logs
- `[VOICE_ERROR]` with "NOT_AVAILABLE" or "START_ERROR"

**Microphone In Use:**
- `[VOICE_ERROR]` with "ERROR_CLIENT" (Android)
- `[VOICE_ERROR]` with "ERROR_AUDIO" (Android)

## Common Issues and Solutions

### Issue: No Transcript Appearing
**Check:**
1. Look for `[VOICE_PARTIAL]` logs - if missing, speech isn't being recognized
2. Verify `[VOICE_AUDIO]` logs on Android - if missing, microphone isn't capturing
3. Check audio levels in `onRmsChanged` logs

**Solutions:**
- Ensure microphone permission is granted
- Close other apps using the microphone
- Speak clearly and loudly
- Check internet connection (both platforms use cloud recognition)

### Issue: ERROR_CLIENT on Android
**Causes:**
- Google app is outdated
- Another app is using the microphone
- Google speech services are down

**Solutions:**
- Update Google app from Play Store
- Close other apps (especially voice assistants)
- Restart the device

### Issue: Permission Errors
**Solutions:**
- iOS: Go to Settings → Your App → Microphone → Enable
- Android: Go to Settings → Apps → Your App → Permissions → Microphone → Enable

### Issue: Real-time Updates Not Working
**Check:**
1. Verify `shouldReportPartialResults = true` in iOS logs
2. Verify `EXTRA_PARTIAL_RESULTS = true` in Android intent
3. Check if `[VOICE_PARTIAL]` logs show `isFinal: false`

**The code now has:**
- iOS: `recognitionRequest.shouldReportPartialResults = true`
- Android: `putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)`

## Debugging Commands

### iOS
```bash
# Watch Xcode console or use:
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "YourAppName"' --level debug
```

### Android
```bash
# View all logs
adb logcat

# Filter by app
adb logcat | grep "$(adb shell ps | grep com.yourapp | awk '{print $2}')"

# Filter by tag
adb logcat SpeechRecognition:V *:S

# Clear logs first
adb logcat -c && adb logcat | grep VOICE
```

### React Native
Logs automatically appear in Metro bundler console. For filtered view:
```bash
# In a separate terminal while Metro is running
npx react-native log-android  # For Android
npx react-native log-ios      # For iOS
```

## Next Steps

If issues persist after checking logs:
1. Copy relevant log snippets showing the error sequence
2. Note the platform (iOS/Android) and version
3. Note any error codes that appear
4. Check if the issue is consistent or intermittent

The comprehensive logging should now clearly show:
- ✅ Whether permissions are granted
- ✅ Whether the native module starts successfully
- ✅ Whether audio is being captured
- ✅ Whether speech is being recognized
- ✅ Whether partial results are flowing through
- ✅ Exact error messages and codes if anything fails
