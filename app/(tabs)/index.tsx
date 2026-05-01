import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PsalmCard } from '@/components/PsalmCard';
import { psalms } from '@/data/psalms';
import { colors, spacing } from '@/theme';

export default function PsalmsList() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h1}>Psalter</Text>
        <Link href="/submit" style={styles.submit}>
          Submit a song
        </Link>
      </View>
      <Text style={styles.subtitle}>All 150 Psalms · set to music</Text>
      <FlatList
        data={psalms}
        keyExtractor={(p) => String(p.number)}
        renderItem={({ item }) => <PsalmCard psalm={item} />}
        contentContainerStyle={{ paddingVertical: spacing.md }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  h1: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  submit: { color: colors.accent, fontWeight: '600' },
});
