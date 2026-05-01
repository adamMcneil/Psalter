import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSpotifyAuth } from '@/spotify/AuthContext';
import { ApiPlaylist, spotifyApi } from '@/spotify/api';
import {
  loadMyPlaylists,
  patchPlaylistsCache,
} from '@/spotify/playlistsCache';
import { songById } from '@/data/catalog';
import { colors, radius, spacing } from '@/theme';

export default function AddToPlaylistScreen() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const song = songId ? songById(songId) : undefined;
  const router = useRouter();
  const { user, getAccessToken, tokens } = useSpotifyAuth();
  const api = useMemo(() => spotifyApi(getAccessToken), [getAccessToken]);

  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const trackId = song ? extractTrackIdFromSong(song.spotifyUrl) : null;
  const trackUri = trackId ? `spotify:track:${trackId}` : null;

  useEffect(() => {
    if (!tokens) return;
    let mounted = true;
    setLoading(true);
    loadMyPlaylists(api)
      .then((list) => {
        if (!mounted) return;
        const writable = list.filter(
          (p) => user && (p.owner.id === user.id || p.collaborative),
        );
        setPlaylists(writable);
      })
      .catch((err) => {
        if (mounted) {
          Alert.alert('Could not load playlists', String(err?.message ?? err));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [api, user, tokens]);

  const onAddTo = async (playlist: ApiPlaylist) => {
    if (!trackUri) return;
    setBusyId(playlist.id);
    try {
      await api.addTracksToPlaylist(playlist.id, [trackUri]);
      Alert.alert('Added', `Added to "${playlist.name}".`);
      router.back();
    } catch (e) {
      Alert.alert('Failed to add', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const onCreateAndAdd = async () => {
    if (!user || !trackUri || !newName.trim()) return;
    setCreating(true);
    try {
      const created = await api.createPlaylist(user.id, newName.trim(), {
        description: 'Created from Psalter',
      });
      await api.addTracksToPlaylist(created.id, [trackUri]);
      patchPlaylistsCache((items) => [created, ...items]);
      Alert.alert('Created', `Added to "${created.name}".`);
      router.back();
    } catch (e) {
      Alert.alert(
        'Failed to create',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setCreating(false);
    }
  };

  if (!song) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Add to playlist' }} />
        <Text style={styles.empty}>Song not found.</Text>
      </Screen>
    );
  }

  if (!tokens) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Add to playlist' }} />
        <Text style={styles.empty}>
          Sign in with Spotify on the Account tab to manage your playlists.
        </Text>
      </Screen>
    );
  }

  if (!trackUri) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Add to playlist' }} />
        <Text style={styles.empty}>
          This song doesn't have a Spotify track ID yet, so it can't be added
          to a playlist.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Add to playlist' }} />
      <View style={styles.header}>
        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.subtitle}>{song.artist}</Text>
      </View>

      <View style={styles.createBox}>
        <Text style={styles.label}>New playlist</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Psalms for the morning commute"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Pressable
            onPress={onCreateAndAdd}
            disabled={!newName.trim() || creating}
            style={[
              styles.create,
              (!newName.trim() || creating) && styles.disabled,
            ]}
          >
            <Text style={styles.createText}>
              {creating ? '…' : 'Create + Add'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.label, { marginTop: spacing.md }]}>
        Your playlists
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onAddTo(item)}
              disabled={busyId === item.id}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.pressed,
                busyId === item.id && styles.disabled,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.tracks.total} track
                  {item.tracks.total === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.add}>{busyId === item.id ? '…' : '+'}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              You don't have any writable playlists yet — create one above.
            </Text>
          }
        />
      )}
    </Screen>
  );
}

function extractTrackIdFromSong(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:\/track\/|spotify:track:)([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginTop: 2 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs },
  createBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  create: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  createText: { color: '#1a1207', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  add: { color: colors.accent, fontSize: 22, fontWeight: '700', marginLeft: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
