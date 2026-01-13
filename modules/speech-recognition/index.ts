import { EventEmitter, EventSubscription, requireNativeModule } from 'expo-modules-core';

// This must match the name in the native module definition
const NativeModule = requireNativeModule('SpeechRecognition');
const emitter = new EventEmitter(NativeModule as any);

let lastTranscript = '';

// Internal listener to track state
emitter.addListener('onPartialResult', (event: any) => {
    console.log(`[VOICE_PARTIAL] JS Module: Received partial result (length: ${event.transcript?.length || 0}, isFinal: ${event.isFinal})`);
    lastTranscript = event.transcript;
});

emitter.addListener('onError', (event: any) => {
    console.error(`[VOICE_ERROR] JS Module: Received error event (code: ${event.code}, message: ${event.message})`);
});

export const checkPermission = async (): Promise<boolean> => {
    try {
        console.log('[VOICE_PERMISSION_CHECK] JS Module: Calling native checkPermission');
        const result = await NativeModule.checkPermission();
        console.log(`[VOICE_PERMISSION_CHECK] JS Module: Permission check result = ${result}`);
        return result;
    } catch (error) {
        console.error('[VOICE_ERROR] JS Module: Error checking permission:', error);
        return false;
    }
};

export const startListening = async () => {
    console.log('[VOICE_NATIVE_START] JS Module: Clearing transcript and calling native startListening');
    lastTranscript = '';
    try {
        await NativeModule.startListening();
        console.log('[VOICE_NATIVE_START] JS Module: Native startListening completed');
    } catch (error) {
        console.error('[VOICE_ERROR] JS Module: Error in startListening:', error);
        throw error;
    }
};

export const stopListening = async (): Promise<string> => {
    console.log('[VOICE_NATIVE_STOP] JS Module: Calling native stopListening');
    try {
        await NativeModule.stopListening();
        console.log(`[VOICE_NATIVE_STOP] JS Module: Native stopListening completed, returning transcript (length: ${lastTranscript.length})`);
        return lastTranscript;
    } catch (error) {
        console.error('[VOICE_ERROR] JS Module: Error in stopListening:', error);
        return lastTranscript;
    }
};

export const onPartialResult = (callback: (text: string) => void): EventSubscription => {
    console.log('[VOICE_PERMISSION_CHECK] JS Module: Registering onPartialResult listener');
    return emitter.addListener('onPartialResult', (event: any) => {
        console.log(`[VOICE_PARTIAL] JS Module: Forwarding partial result to callback (length: ${event.transcript?.length || 0})`);
        callback(event.transcript);
    });
};

export const onError = (callback: (error: string, code?: string) => void): EventSubscription => {
    console.log('[VOICE_PERMISSION_CHECK] JS Module: Registering onError listener');
    return emitter.addListener('onError', (event: any) => {
        console.log(`[VOICE_ERROR] JS Module: Forwarding error to callback (code: ${event.code})`);
        callback(event.message, event.code);
    });
};
