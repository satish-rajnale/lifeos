import { EventEmitter, EventSubscription, requireNativeModule } from 'expo-modules-core';

const NativeModule = requireNativeModule('TextToSpeech');
const emitter = new EventEmitter(NativeModule as any);

export const speak = async (text: string, options?: { pitch?: number; rate?: number }): Promise<void> => {
    const { pitch = 1.0, rate = 1.0 } = options || {};
    await NativeModule.speak(text, pitch, rate);
};

export const stop = async (): Promise<void> => {
    await NativeModule.stop();
};

export const isSpeaking = async (): Promise<boolean> => {
    return await NativeModule.isSpeaking();
};

export const onStart = (callback: () => void): EventSubscription => {
    return emitter.addListener('onStart', callback);
};

export const onDone = (callback: () => void): EventSubscription => {
    return emitter.addListener('onDone', callback);
};

export const onError = (callback: (error: string) => void): EventSubscription => {
    return emitter.addListener('onError', (event: any) => {
        callback(event.message);
    });
};
