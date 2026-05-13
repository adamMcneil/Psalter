import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  // Scroll speed in pixels per second.
  speed?: number;
  // Pause duration at each end of the scroll, in ms.
  pauseMs?: number;
}

// Horizontal marquee that scrolls only when the text overflows its container.
// Used for long song titles in the MiniPlayer so the full name remains readable.
export function MarqueeText({
  text,
  style,
  containerStyle,
  speed = 30,
  pauseMs = 1200,
}: MarqueeTextProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;

  const overflow = Math.max(0, textWidth - containerWidth);
  const needsScroll = overflow > 0;

  // Re-measure when the text changes so we don't animate using the previous
  // track's geometry before the new layout fires.
  useEffect(() => {
    setTextWidth(0);
  }, [text]);

  useEffect(() => {
    if (!needsScroll) {
      tx.setValue(0);
      return;
    }
    const duration = Math.max(1500, (overflow / speed) * 1000);
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      tx.setValue(0);
      Animated.sequence([
        Animated.delay(pauseMs),
        Animated.timing(tx, {
          toValue: -overflow,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(pauseMs),
      ]).start(({ finished }) => {
        if (finished && !cancelled) loop();
      });
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [needsScroll, overflow, speed, pauseMs, tx]);

  return (
    <View
      style={[styles.clip, containerStyle]}
      onLayout={(e: LayoutChangeEvent) =>
        setContainerWidth(e.nativeEvent.layout.width)
      }
    >
      <View style={styles.measure} pointerEvents="none">
        <Text
          style={[style, styles.measureText]}
          onLayout={(e: LayoutChangeEvent) =>
            setTextWidth(e.nativeEvent.layout.width)
          }
        >
          {text}
        </Text>
      </View>
      <Animated.View
        style={[
          styles.row,
          {
            transform: [{ translateX: tx }],
            width: textWidth > 0 ? textWidth : undefined,
          },
        ]}
      >
        <Text style={style} numberOfLines={1} ellipsizeMode="clip">
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  measure: {
    position: 'absolute',
    opacity: 0,
    top: 0,
    left: 0,
    // Big enough to let any realistic single-line title lay out without
    // wrapping; the parent clip + opacity hides this from the user.
    width: 10000,
  },
  measureText: {
    // RN Web turns numberOfLines into an ellipsis CSS rule, which would
    // truncate the measurement. Keep this Text unconstrained so onLayout
    // reports the true single-line width.
    alignSelf: 'flex-start',
  },
  row: { flexDirection: 'row' },
});
