import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { Theme } from '../../constants/theme';
import { useMobileVoiceAssistant } from '../../hooks/useMobileVoiceAssistant';
import { aiAssistantService, type AiChatMessage } from '../../services/aiAssistantService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useAppStore } from '../../store/appStore';

interface AiAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

const generateChatId = () => {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
};

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  visible,
  onClose,
  initialPrompt,
}) => {
  const [chatId, setChatId] = useState<string>(generateChatId);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your RetailSuite Voice & Navigation AI. You can speak in Urdu, Roman Urdu, or English to navigate reports or draft vouchers.',
    },
  ]);

  const router = useRouter();
  const pathname = usePathname();
  const scrollViewRef = useRef<ScrollView>(null);
  const { voiceLanguage, setVoiceLanguage } = useAppStore();

  const handleCycleLanguage = () => {
    if (voiceLanguage === 'en-PK') {
      setVoiceLanguage('ur-PK');
    } else if (voiceLanguage === 'ur-PK') {
      setVoiceLanguage('auto');
    } else {
      setVoiceLanguage('en-PK');
    }
  };

  const handleNewChat = () => {
    stopListening(false);
    stopSpeaking();
    hasDispatchedThisHoldRef.current = false;
    isHoldingRef.current = false;
    setInputText('');
    setChatId(generateChatId());
    setMessages([
      {
        role: 'assistant',
        content:
          'Hello! I am your RetailSuite Voice & Navigation AI. You can speak in Urdu, Roman Urdu, or English to navigate reports or draft vouchers.',
      },
    ]);
  };

  const holdStartTimeRef = useRef<number>(0);
  const isHoldingRef = useRef(false);
  const hasDispatchedThisHoldRef = useRef(false);
  const micScaleAnim = useRef(new Animated.Value(1)).current;

  const handleSendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    // Immediately stop mic and any ongoing read-aloud TTS
    stopListening(false);
    stopSpeaking();
    hasDispatchedThisHoldRef.current = true;

    setInputText('');
    const userMsg: AiChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await aiAssistantService.chat({
        prompt: trimmed,
        chatId: chatId,
        currentRoute: pathname,
        history: messages,
      });

      if (response.chatId && response.chatId !== chatId) {
        setChatId(response.chatId);
      }

      const assistantMsg: AiChatMessage = {
        role: 'assistant',
        content: response.replyText || 'Command processed.',
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Natural speech response if not muted
      if (!voiceMuted && response.replyText) {
        speak(response.replyText);
      }

      // Execute Action
      const isNavigate =
        String(response.actionType).toLowerCase() === 'navigate' ||
        response.actionType === 1;
      const isDraft =
        String(response.actionType).toLowerCase() === 'draftvoucher' ||
        response.actionType === 2;

      if (isNavigate && response.targetRoute) {
        const target = response.targetRoute.toLowerCase();

        if (target.includes('report')) {
          let reportName = 'account_statement';
          if (target.includes('/reports/')) {
            reportName = response.targetRoute.split('/reports/')[1] || 'account_statement';
          } else if (response.actionPayload?.reportType) {
            reportName = response.actionPayload.reportType;
          }
          router.push({
            pathname: '/(tabs)/reports',
            params: {
              reportType: reportName,
              autoViewPdf: 'true',
              t: Date.now().toString(),
              ...(response.actionPayload || {}),
            },
          });
          onClose();
        } else if (target.includes('payment-voucher') || target.includes('/payments')) {
          router.push('/payments');
          onClose();
        } else if (target.includes('receipt-voucher') || target.includes('/receipts')) {
          router.push('/receipts');
          onClose();
        } else if (target.includes('sale-supply')) {
          router.push('/sale-supplies');
          onClose();
        } else if (target.includes('sale') || target.includes('pos')) {
          router.push('/sales');
          onClose();
        } else if (target.includes('purchase')) {
          router.push('/purchases');
          onClose();
        }
      } else if (isDraft && response.targetRoute) {
        const target = response.targetRoute.toLowerCase();
        if (target.includes('payment')) {
          router.push({
            pathname: '/payments/[voucherNo]',
            params: {
              voucherNo: 'new',
              draftData: JSON.stringify(response.actionPayload || {}),
            },
          });
          onClose();
        } else if (target.includes('receipt')) {
          router.push({
            pathname: '/receipts/[voucherNo]',
            params: {
              voucherNo: 'new',
              draftData: JSON.stringify(response.actionPayload || {}),
            },
          });
          onClose();
        }
      }
    } catch (error: any) {
      console.error('AI chat failed', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue processing your request.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const {
    isSupported,
    isListening,
    isSpeaking,
    transcript,
    errorMessage,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useMobileVoiceAssistant({
    onFinalTranscript: (spokenText) => {
      handleSendPrompt(spokenText);
    },
  });

  useEffect(() => {
    if (visible && initialPrompt) {
      handleSendPrompt(initialPrompt);
    }
  }, [visible, initialPrompt]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, isLoading, transcript]);

  // Ensure scroll view always scrolls to bottom when keyboard opens
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }
    );
    return () => {
      showSub.remove();
    };
  }, []);

  // Pulse animation when listening in modal
  useEffect(() => {
    let loopAnim: Animated.CompositeAnimation | null = null;
    if (isListening) {
      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(micScaleAnim, {
            toValue: 1.35,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(micScaleAnim, {
            toValue: 1.18,
            duration: 450,
            useNativeDriver: true,
          }),
        ])
      );
      loopAnim.start();
    } else {
      Animated.spring(micScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      loopAnim?.stop();
    };
  }, [isListening, micScaleAnim]);

  // Press & Hold (Walkie-Talkie) Handlers
  const handleHoldStart = () => {
    if (isLoading) return;
    holdStartTimeRef.current = Date.now();
    isHoldingRef.current = true;
    hasDispatchedThisHoldRef.current = false;
    Animated.spring(micScaleAnim, {
      toValue: 1.28,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
    startListening();
  };

  const handleHoldEnd = () => {
    const wasHolding = isHoldingRef.current;
    isHoldingRef.current = false;

    Animated.spring(micScaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

    if (!wasHolding) return;

    // If silence timer already dispatched this speech, don't re-send
    if (hasDispatchedThisHoldRef.current) {
      hasDispatchedThisHoldRef.current = false;
      return;
    }

    const duration = Date.now() - holdStartTimeRef.current;
    if (duration > 300) {
      hasDispatchedThisHoldRef.current = true;
      stopListening(true);
    }
  };

  const toggleVoiceMode = () => {
    if (isLoading) return;
    if (isListening) {
      hasDispatchedThisHoldRef.current = true;
      stopListening(true);
    } else {
      stopSpeaking();
      hasDispatchedThisHoldRef.current = false;
      Animated.spring(micScaleAnim, {
        toValue: 1.3,
        friction: 5,
        useNativeDriver: true,
      }).start();
      startListening();
    }
  };

  const suggestionChips = [
    'Show payment listing for this month',
    'Show receipt vouchers of yesterday',
    'What is the balance of ABC?',
    'Create payment voucher of $500 for ABC',
    'Create receipt voucher of $1000 from XYZ',
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        stopListening(false);
        stopSpeaking();
        onClose();
      }}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#1A73E8', '#8E24AA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Ionicons name="flash" size={16} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>RetailSuite AI</Text>
              <Text style={styles.headerSubtitle}>
                {isListening
                  ? 'Listening...'
                  : isSpeaking
                  ? 'Speaking...'
                  : voiceLanguage === 'en-PK'
                  ? 'Pakistani English Accent'
                  : voiceLanguage === 'ur-PK'
                  ? 'Urdu / Roman Urdu Mode'
                  : 'Auto (Urdu & English - PK)'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleCycleLanguage}
              style={styles.langPill}
              activeOpacity={0.7}
            >
              <Text style={styles.langPillText}>
                {voiceLanguage === 'en-PK'
                  ? '🇵🇰 English'
                  : voiceLanguage === 'ur-PK'
                  ? '🇵🇰 اردو'
                  : '🌐 Auto'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNewChat}
              style={styles.iconButton}
              activeOpacity={0.7}
              accessibilityLabel="Start New Chat"
            >
              <Ionicons name="create-outline" size={22} color={Theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setVoiceMuted(!voiceMuted);
                if (!voiceMuted) stopSpeaking();
              }}
              style={styles.iconButton}
            >
              <Ionicons
                name={voiceMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                size={22}
                color={Theme.colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                stopListening(false);
                stopSpeaking();
                onClose();
              }}
              style={styles.iconButton}
            >
              <Ionicons name="close" size={24} color={Theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Keyboard-Resilient Content Container */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Messages List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <View
                  key={idx}
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <MarkdownRenderer content={m.content} isUser={isUser} />
                </View>
              );
            })}

            {isLoading && (
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={Theme.colors.primary} />
                <Text style={styles.loadingText}>Processing intent & database...</Text>
              </View>
            )}

            {errorMessage && (
              <TouchableOpacity
                style={styles.errorBubble}
                onPress={() => Linking.openSettings()}
                activeOpacity={0.7}
              >
                <Ionicons name="alert-circle" size={16} color={Theme.colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Ionicons name="open-outline" size={16} color={Theme.colors.danger} />
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Live Listening Banner */}
          {isListening && (
            <View style={styles.listeningBanner}>
              <View style={styles.listeningDot} />
              <Text style={styles.listeningText}>
                {transcript ? `"${transcript}"` : 'Listening... Speak or release to send'}
              </Text>
            </View>
          )}

          {/* Suggestion Chips */}
          <View style={styles.chipsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {suggestionChips.map((chip, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.chip}
                  disabled={isLoading}
                  onPress={() => handleSendPrompt(chip)}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar */}
          <View style={styles.inputBar}>
            {/* Mic Button: Press & Hold or Tap to Toggle */}
            <Animated.View style={{ transform: [{ scale: micScaleAnim }] }}>
              <TouchableOpacity
                onPressIn={handleHoldStart}
                onPressOut={handleHoldEnd}
                onPress={() => {
                  if (Date.now() - holdStartTimeRef.current < 300) {
                    toggleVoiceMode();
                  }
                }}
                activeOpacity={0.7}
                style={[
                  styles.micButton,
                  isListening && styles.micButtonListening,
                ]}
              >
                <Ionicons
                  name={isListening ? 'mic' : 'mic-outline'}
                  size={isListening ? 26 : 22}
                  color="#fff"
                />
              </TouchableOpacity>
            </Animated.View>

            <TextInput
              style={styles.input}
              placeholder="Ask AI or speak in Urdu/English..."
              placeholderTextColor={Theme.colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
              onSubmitEditing={() => handleSendPrompt(inputText)}
              returnKeyType="send"
              editable={!isLoading}
            />

            <TouchableOpacity
              onPress={() => handleSendPrompt(inputText)}
              disabled={!inputText.trim() || isLoading}
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
              ]}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFD',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langPill: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderBottomLeftRadius: 4,
    ...Theme.shadows.sm,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: Theme.colors.text,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  loadingText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  errorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
  },
  errorText: {
    fontSize: 12,
    color: Theme.colors.danger,
    flex: 1,
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 8,
  },
  listeningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.danger,
  },
  listeningText: {
    fontSize: 13,
    color: Theme.colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  chipsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  chipText: {
    fontSize: 12,
    color: Theme.colors.text,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    gap: 8,
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonListening: {
    backgroundColor: Theme.colors.danger,
    shadowColor: Theme.colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: '#F3F4F6',
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 14,
    color: Theme.colors.text,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
});
