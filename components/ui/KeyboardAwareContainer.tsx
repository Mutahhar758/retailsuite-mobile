import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, LayoutChangeEvent, Platform, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '../../hooks/useKeyboard';

/**
 * Keeps content above the soft keyboard on every Android mode:
 *  - If the OS already resized the window (adjustResize), nothing extra is added.
 *  - If it did not (edge-to-edge / Expo Go / ignored config), bottom padding equal to the
 *    uncovered part of the keyboard is added so inputs never hide behind it.
 * iOS uses the standard KeyboardAvoidingView.
 * Extra props like `behavior` / `keyboardVerticalOffset` are accepted and ignored on Android.
 */
export const KeyboardAwareContainer: React.FC<
  ViewProps & { behavior?: any; keyboardVerticalOffset?: number }
> = ({ style, children, behavior, keyboardVerticalOffset, onLayout, ...rest }) => {
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const insets = useSafeAreaInsets();
  const baseHeight = useRef(0);
  const [height, setHeight] = useState(0);

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset ?? 88}
        style={style}
        onLayout={onLayout}
        {...rest}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (!isKeyboardVisible) baseHeight.current = h;
    setHeight(h);
    onLayout?.(e);
  };

  // How much the window already shrank because of the keyboard
  const alreadyResized = isKeyboardVisible && baseHeight.current > 0 ? Math.max(0, baseHeight.current - height) : 0;
  const pad = isKeyboardVisible ? Math.max(0, keyboardHeight - alreadyResized - insets.bottom) : 0;

  return (
    <View style={[style, { paddingBottom: pad }]} onLayout={handleLayout} {...rest}>
      {children}
    </View>
  );
};
