import { Tabs } from 'expo-router';
import { colors } from '@/theme';

// The visible navigation bar lives at the root layout (src/components/BottomNav)
// so it persists across detail screens. The Tabs navigator still owns these
// routes; we just hide its built-in bar.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
