import { useState, useRef, useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useAppStore, type VoiceLanguageMode } from '../store/appStore';

// Safely obtain native module without throwing in Expo Go sandbox
let SpeechRecognitionModule: any = null;
try {
  SpeechRecognitionModule = requireOptionalNativeModule('ExpoSpeechRecognition');
} catch (e) {
  SpeechRecognitionModule = null;
}

export interface UseMobileVoiceAssistantProps {
  onFinalTranscript?: (transcript: string) => void;
  lang?: VoiceLanguageMode | string;
}

// Pakistani retail accounting terminology to bias speech recognition accuracy
export const RETAIL_CONTEXTUAL_STRINGS = [
  'payment voucher',
  'receipt voucher',
  'sale voucher',
  'purchase voucher',
  'account statement',
  'ledger',
  'balance',
  'khata',
  'hisab',
  'parchi',
  'customer',
  'vendor',
  'supplier',
  'account',
  'cash',
  'bank',
  'rupees',
  'debit',
  'credit',
  'banao',
  'kholo',
  'dikhao',
  'batao',
  'jama',
  'bhejo',
  'adayege',
];

export function cleanSpeechText(text: string): string {
  if (!text) return '';
  return text
    // 1. Remove markdown code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // 2. Remove markdown tables entirely (cell pipes & divider rows confuse TTS engines)
    .replace(/^\|.*\|$/gm, '')
    .replace(/^\s*[-:| ]{3,}\s*$/gm, '')
    // 3. Remove markdown headers (# Title)
    .replace(/^#+\s+/gm, '')
    // 4. Remove markdown bold/italic asterisks
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // 5. Remove bullets and list markers at start of line
    .replace(/^[•\-\*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // 6. Expand currency abbreviations for natural spoken audio
    .replace(/\bRs\.?\s*/gi, 'Rupees ')
    // 7. Remove emojis and decorative unicode icons that interrupt speech engines
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    // 8. Clean parentheses, colons, slashes so speech pauses naturally
    .replace(/\(([^)]+)\)/g, ', $1, ')
    .replace(/:/g, ', ')
    .replace(/[/\\|~_]/g, ' ')
    // 9. Collapse multiple periods or dashes
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
    // 10. Collapse excess whitespace and newlines
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectSpeechLanguage(text: string): 'ur-PK' | 'en-IN' | 'en-PK' | 'en-US' {
  // 1. Native Urdu script (اردو) -> use ur-PK
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ur-PK';
  }

  // 2. Latin script with Roman Urdu -> use en-IN (Subcontinent English voice)
  // Google TTS's 'ur-PK' engine only recognizes Arabic/Urdu unicode characters.
  // When 'ur-PK' is passed to Latin text, it skips Roman Urdu words and only reads English words.
  // Using 'en-IN' allows Google TTS to read BOTH Roman Urdu and English fluently.
  const romanUrduPattern = /\b(hai|hain|ka|ki|ke|ko|se|kr|kar|khol|karde|kardo|dikhao|banao|dekhna|batao|batayein|iska|iski|iske|kitna|kitne|paise|khata|parchi|chahiye|sahi|diya|diye|lene|dena|mene|mujhe|aapka|matlooba)\b/i;
  if (romanUrduPattern.test(text)) {
    return 'en-IN';
  }

  return 'en-PK';
}

export function useMobileVoiceAssistant({
  onFinalTranscript,
  lang,
}: UseMobileVoiceAssistantProps = {}) {
  const isSupported = Boolean(SpeechRecognitionModule);
  const storedVoiceLang = useAppStore((s) => s.voiceLanguage);
  const effectiveLang = lang || storedVoiceLang || 'en-PK';

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAwaitingFinalRef = useRef(false);

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const latestTranscriptRef = useRef('');
  const availableVoicesRef = useRef<Speech.Voice[]>([]);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // Discover and cache available system voices
  useEffect(() => {
    const discoverVoices = async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        if (voices && voices.length > 0) {
          availableVoicesRef.current = voices;
        }
      } catch (err) {
        console.warn('Could not discover TTS voices', err);
      }
    };

    discoverVoices();
  }, []);

  const stopSpeaking = useCallback(async () => {
    try {
      await Speech.stop();
    } catch {}
    setIsSpeaking(false);
  }, []);

  const dispatchCaptured = useCallback(() => {
    if (finalTimeoutRef.current) {
      clearTimeout(finalTimeoutRef.current);
      finalTimeoutRef.current = null;
    }
    isAwaitingFinalRef.current = false;

    const captured = latestTranscriptRef.current.trim();
    latestTranscriptRef.current = '';
    setTranscript('');

    if (captured) {
      onFinalTranscriptRef.current?.(captured);
    }
  }, []);

  const stopListening = useCallback((submitImmediately: boolean = false) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (SpeechRecognitionModule) {
      try {
        SpeechRecognitionModule.stop?.();
      } catch {}
    }

    setIsListening(false);

    if (submitImmediately) {
      isAwaitingFinalRef.current = true;
      // Allow a 350ms window for the native recognizer to flush the audio buffer and emit trailing words
      if (finalTimeoutRef.current) {
        clearTimeout(finalTimeoutRef.current);
      }
      finalTimeoutRef.current = setTimeout(() => {
        dispatchCaptured();
      }, 350);
    } else {
      latestTranscriptRef.current = '';
      setTranscript('');
    }
  }, [dispatchCaptured]);

  const startListening = useCallback(async () => {
    // 1. Immediately abort any active read-aloud TTS when microphone opens
    await stopSpeaking();

    if (finalTimeoutRef.current) {
      clearTimeout(finalTimeoutRef.current);
      finalTimeoutRef.current = null;
    }
    isAwaitingFinalRef.current = false;

    if (!SpeechRecognitionModule) {
      setErrorMessage(
        'Speech recognition requires a development build (run npx expo run:android). Text chat & voice read-aloud are fully available in Expo Go!'
      );
      return;
    }

    // 2. Clear previous transcript
    setTranscript('');
    latestTranscriptRef.current = '';
    setErrorMessage(null);

    try {
      // 3. Request permissions
      const perm = await SpeechRecognitionModule.requestPermissionsAsync?.();
      if (perm && !perm.granted) {
        if (!perm.canAskAgain) {
          setErrorMessage(
            'Microphone permission is blocked. Tap here to open App Settings and allow Microphone.'
          );
        } else {
          setErrorMessage('Microphone and speech permissions are required to use voice assistant.');
        }
        setIsListening(false);
        return;
      }

      // 4. Trigger tactile feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 5. Select Pakistani language model
      const activeLang =
        effectiveLang === 'auto'
          ? (Platform.OS === 'android' ? 'ur-PK' : 'en-PK')
          : effectiveLang;

      SpeechRecognitionModule.start?.({
        lang: activeLang,
        interimResults: true,
        continuous: true,
        contextualStrings: RETAIL_CONTEXTUAL_STRINGS,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
          EXTRA_ENABLE_LANGUAGE_DETECTION: true,
          EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: ['ur-PK', 'en-PK', 'en-US'],
          EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: ['ur-PK', 'en-PK', 'en-US'],
          EXTRA_ENABLE_LANGUAGE_SWITCH: 'balanced',
        },
      });

      setIsListening(true);
    } catch (err: any) {
      console.warn('Failed to start speech recognition', err);
      setErrorMessage(err?.message || 'Could not start speech recognition');
      setIsListening(false);
    }
  }, [effectiveLang, stopSpeaking]);

  // Hook into Speech Recognition Events safely when native module is present
  useEffect(() => {
    if (!SpeechRecognitionModule) return;

    const subStart = SpeechRecognitionModule.addListener?.('start', () => {
      setIsListening(true);
      setErrorMessage(null);
    });

    const subResult = SpeechRecognitionModule.addListener?.('result', (event: any) => {
      const recognizedText = event?.results?.[0]?.transcript || '';
      const isFinal = Boolean(event?.isFinal);

      if (recognizedText) {
        latestTranscriptRef.current = recognizedText;
        setTranscript(recognizedText);

        // If the user already released the button and is awaiting the finalized buffer words
        if (isAwaitingFinalRef.current) {
          if (isFinal) {
            // Got final result from native engine; submit immediately without delay
            dispatchCaptured();
            return;
          } else {
            // New interim words arrived; give 200ms grace for final packet
            if (finalTimeoutRef.current) {
              clearTimeout(finalTimeoutRef.current);
            }
            finalTimeoutRef.current = setTimeout(() => {
              dispatchCaptured();
            }, 250);
          }
        }

        // Fast silence detection: submit automatically after 950ms of silence (reduced from 2.2s)
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          stopListening(true);
        }, 950);
      }
    });

    const subError = SpeechRecognitionModule.addListener?.('error', (event: any) => {
      if (event?.error === 'no-speech') {
        setIsListening(false);
        if (isAwaitingFinalRef.current) {
          dispatchCaptured();
        }
        return;
      }
      setIsListening(false);
      if (isAwaitingFinalRef.current) {
        dispatchCaptured();
      }
      setErrorMessage(event?.message || 'Speech recognition error');
    });

    const subEnd = SpeechRecognitionModule.addListener?.('end', () => {
      setIsListening(false);
      if (isAwaitingFinalRef.current) {
        dispatchCaptured();
      }
    });

    return () => {
      subStart?.remove?.();
      subResult?.remove?.();
      subError?.remove?.();
      subEnd?.remove?.();
    };
  }, [dispatchCaptured, stopListening]);

  const speak = useCallback(async (text: string, voiceLang?: string) => {
    if (!text) return;

    try {
      await Speech.stop();
      const clean = cleanSpeechText(text);
      if (!clean) return;

      const detectedLang = voiceLang || detectSpeechLanguage(clean);

      // Select a male voice that strictly matches the target language prefix
      let matchedVoice: string | undefined = undefined;
      const langPrefix = detectedLang.split('-')[0].toLowerCase();
      const matchingVoices = availableVoicesRef.current.filter((v) =>
        v.language.toLowerCase().startsWith(langPrefix)
      );

      if (matchingVoices.length > 0) {
        const maleVoice = matchingVoices.find((v) => {
          const str = (v.name + ' ' + v.identifier).toLowerCase();
          return (
            str.includes('male') ||
            str.includes('man') ||
            str.includes('urm') ||
            str.includes('-m-') ||
            str.includes('guy') ||
            str.includes('david') ||
            str.includes('george') ||
            str.includes('rishi')
          );
        }) || matchingVoices[0];

        if (maleVoice) {
          matchedVoice = maleVoice.identifier;
        }
      }

      setIsSpeaking(true);
      await Speech.speak(clean, {
        language: detectedLang,
        voice: matchedVoice, // only passed if voice language strictly matches detectedLang!
        pitch: 0.90, // Natural, clear, pleasant male timbre without distortion
        rate: 0.96, // Conversational pacing
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: (err) => {
          console.warn('Speech playback error:', err);
          setIsSpeaking(false);
        },
      });
    } catch (err) {
      console.warn('Speech synthesis failed', err);
      setIsSpeaking(false);
    }
  }, []);

  return {
    isSupported,
    isListening,
    isSpeaking,
    transcript,
    errorMessage,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
