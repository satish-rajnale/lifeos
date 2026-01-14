import { EventEmitter, EventSubscription, requireNativeModule } from 'expo-modules-core';

// This must match the name in the native module definition
const NativeModule = requireNativeModule('SpeechRecognition');
const emitter = new EventEmitter(NativeModule as any);

let lastTranscript = '';

// Internal listener to track state
emitter.addListener('onPartialResult', (event: any) => {
    lastTranscript = event.transcript;
});

export const checkPermission = async (): Promise<boolean> => {
    try {
        return await NativeModule.checkPermission();
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
};

export const startListening = async () => {
    lastTranscript = '';
    await NativeModule.startListening();
};

export const stopListening = async (): Promise<string> => {
    await NativeModule.stopListening();
    return lastTranscript;
};

export const onPartialResult = (callback: (text: string) => void): EventSubscription => {
    return emitter.addListener('onPartialResult', (event: any) => {
        callback(event.transcript);
    });
};

export const onError = (callback: (error: string, code?: string) => void): EventSubscription => {
    return emitter.addListener('onError', (event: any) => {
        callback(event.message, event.code);
    });
};
