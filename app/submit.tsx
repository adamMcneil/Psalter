import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { colors, fontSize, radius, spacing } from '@/theme';

interface FormState {
  psalm: string;
  title: string;
  artist: string;
  link: string;
  notes: string;
}

const empty: FormState = {
  psalm: '',
  title: '',
  artist: '',
  link: '',
  notes: '',
};

export default function SubmitScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const set = (k: keyof FormState) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const psalmNum = Number(form.psalm);
  const valid =
    form.psalm.trim() !== '' &&
    Number.isInteger(psalmNum) &&
    psalmNum >= 1 &&
    psalmNum <= 150 &&
    form.title.trim() !== '' &&
    form.artist.trim() !== '';

  const onSubmit = () => {
    if (!valid) return;
    Alert.alert(
      'Thanks!',
      'Submission saved locally. A backend endpoint will be wired up later.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
    setForm(empty);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
          <Text style={styles.h1}>Submit a song</Text>
          <Text style={styles.intro}>
            Suggest a Psalm-based song to add to the catalog. Paste a Spotify
            track link — that's what powers in-app playback, Liked Songs, and
            playlists.
          </Text>

          <Field
            label="Psalm number (1–150)"
            value={form.psalm}
            onChangeText={set('psalm')}
            keyboardType="number-pad"
          />
          <Field label="Song title" value={form.title} onChangeText={set('title')} />
          <Field label="Artist" value={form.artist} onChangeText={set('artist')} />
          <Field
            label="Spotify track link (open.spotify.com/track/…)"
            value={form.link}
            onChangeText={set('link')}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Field
            label="Notes"
            value={form.notes}
            onChangeText={set('notes')}
            multiline
          />

          <Pressable
            style={[styles.submit, !valid && styles.submitDisabled]}
            onPress={onSubmit}
            disabled={!valid}
          >
            <Text
              style={[styles.submitText, !valid && styles.submitTextDisabled]}
            >
              Send suggestion
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  multiline,
  ...rest
}: {
  label: string;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMulti]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: {
    color: colors.text,
    fontSize: fontSize.h1,
    fontWeight: '800',
    paddingTop: spacing.md,
    letterSpacing: -0.5,
  },
  intro: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    fontSize: fontSize.md,
    lineHeight: 19,
  },
  field: { marginBottom: spacing.md },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  submit: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  submitText: { color: '#1a1207', fontWeight: '800', fontSize: fontSize.lg },
  submitTextDisabled: { color: colors.textMuted },
});
