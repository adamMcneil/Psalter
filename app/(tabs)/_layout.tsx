import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme';

const TabIcon = ({ glyph, color }: { glyph: string; color: string }) => (
  <Text style={{ color, fontSize: 18 }}>{glyph}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Psalms',
          tabBarIcon: ({ color }) => <TabIcon glyph="❖" color={color} />,
        }}
      />
      <Tabs.Screen
        name="themes"
        options={{
          title: 'Themes',
          tabBarIcon: ({ color }) => <TabIcon glyph="✦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <TabIcon glyph="⌕" color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color }) => <TabIcon glyph="♥" color={color} />,
        }}
      />
    </Tabs>
  );
}
