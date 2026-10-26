import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Animated,
  Platform,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileVoiceAssistant } from '../../hooks/useMobileVoiceAssistant';
import { AiAssistantModal } from './AiAssistantModal';

const ORB_SIZE = 56;

export const FloatingAiOrb: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [modalVisible, setModalVisible] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);

  // Position offsets
  const bottomOffset = Platform.OS === 'android' ? insets.bottom + 80 : insets.bottom + 90;

  // Animated values for dragging and press/pulse feedback
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Gesture refs
  const isDraggingRef = useRef(false);
  const isHoldingRef = useRef(false);
  const hasDispatchedThisHoldRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isSupported,
    isListening,
    startListening,
    stopListening,
    stopSpeaking,
  } = useMobileVoiceAssistant({
    onFinalTranscript: (spokenText) => {
      hasDispatchedThisHoldRef.current = true;
      setInitialPrompt(spokenText);
      setModalVisible(true);
    },
  });

  // Scale up and pulse prominently when listening
  useEffect(() => {
    let loopAnim: Animated.CompositeAnimation | null = null;
    if (isListening) {
      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.40,
            duration: 450,
            useNativeDriver: false,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.25,
            duration: 450,
            useNativeDriver: false,
          }),
        ])
      );
      loopAnim.start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }).start();
    }

    return () => {
      loopAnim?.stop();
    };
  }, [isListening, scaleAnim]);

  // Keep orb within safe screen bounds
  const clampPosition = () => {
    const naturalX = windowWidth - ORB_SIZE - 20;
    const naturalY = windowHeight - ORB_SIZE - bottomOffset;

    const minX = insets.left + 16;
    const maxX = windowWidth - insets.right - ORB_SIZE - 16;
    const minY = insets.top + 16;
    const maxY = windowHeight - insets.bottom - ORB_SIZE - 16;

    const minPanX = minX - naturalX;
    const maxPanX = maxX - naturalX;
    const minPanY = minY - naturalY;
    const maxPanY = maxY - naturalY;

    const curX = (pan.x as any)._value;
    const curY = (pan.y as any)._value;

    const clampedX = Math.min(Math.max(curX, minPanX), maxPanX);
    const clampedY = Math.min(Math.max(curY, minPanY), maxPanY);

    if (clampedX !== curX || clampedY !== curY) {
      Animated.spring(pan, {
        toValue: { x: clampedX, y: clampedY },
        useNativeDriver: false,
        friction: 6,
        tension: 40,
      }).start();
    }
  };

  // PanResponder to handle drag vs hold vs tap
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });

        isDraggingRef.current = false;
        isHoldingRef.current = false;
        hasDispatchedThisHoldRef.current = false;

        // Immediate tactile expansion when pressed down
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          friction: 6,
          tension: 100,
          useNativeDriver: false,
        }).start();

        // 220ms threshold for walkie-talkie hold-to-speak: expand bigger to 1.35x and listen
        holdTimerRef.current = setTimeout(() => {
          if (!isDraggingRef.current) {
            isHoldingRef.current = true;
            Animated.spring(scaleAnim, {
              toValue: 1.35,
              friction: 5,
              tension: 110,
              useNativeDriver: false,
            }).start();
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
            if (isSupported) {
              startListening();
            }
          }
        }, 220);
      },
      onPanResponderMove: (evt, gestureState) => {
        const dist = Math.hypot(gestureState.dx, gestureState.dy);
        if (!isDraggingRef.current && dist > 7) {
          isDraggingRef.current = true;
          // When moving/dragging, return scale to 1.0 for precise dragging
          Animated.spring(scaleAnim, {
            toValue: 1.0,
            friction: 6,
            useNativeDriver: false,
          }).start();
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
          if (isHoldingRef.current) {
            isHoldingRef.current = false;
            stopListening(false);
          }
        }

        if (isDraggingRef.current) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: false,
        }).start();

        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        pan.flattenOffset();

        if (isDraggingRef.current) {
          clampPosition();
          isDraggingRef.current = false;
          return;
        }

        // Tap or Hold Release
        if (isHoldingRef.current) {
          isHoldingRef.current = false;
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          if (!hasDispatchedThisHoldRef.current) {
            hasDispatchedThisHoldRef.current = true;
            stopListening(true);
          }
        } else {
          // Quick tap (<220ms): open chat modal cleanly
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          stopListening(false);
          stopSpeaking();
          setInitialPrompt(undefined);
          setModalVisible(true);
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: false,
        }).start();
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        pan.flattenOffset();
        clampPosition();
        if (isHoldingRef.current) {
          isHoldingRef.current = false;
          stopListening(false);
        }
        isDraggingRef.current = false;
      },
    })
  ).current;

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.floatingContainer,
          {
            right: 20,
            bottom: bottomOffset,
            transform: [
              ...pan.getTranslateTransform(),
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={
            isListening
              ? ['#D93025', '#FF4D4D', '#EA4335']
              : ['#1A73E8', '#8E24AA', '#00C9FF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.orb, isListening && styles.orbListening]}
        >
          <Ionicons
            name={isListening ? 'mic' : 'flash'}
            size={isListening ? 30 : 26}
            color="#fff"
          />
        </LinearGradient>
      </Animated.View>

      <AiAssistantModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setInitialPrompt(undefined);
        }}
        initialPrompt={initialPrompt}
      />
    </>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    zIndex: 99999,
    elevation: 14,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  orbListening: {
    shadowColor: '#D93025',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 2,
    borderColor: '#FFEAEA',
  },
});
