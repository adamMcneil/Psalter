# Psalms Music App (Spotify Edition) - Project Brief

## What I'm building

A free, non-commercial mobile app (iOS + Android) that helps people discover and listen to music based on the Psalms by curating from Spotify's catalog. Users log in with their Spotify account and the app becomes a beautifully focused Psalms-only listening experience layered on top of Spotify's catalog and player.

## The core concept

The app is essentially a **curation and discovery layer** over Spotify:
- Spotify hosts and streams the audio (handles all licensing)
- My app provides Psalm-organized browsing, curated playlists, and a focused experience
- Playback happens through the Spotify SDK
- Users need a Spotify account (free tier works with limitations; Premium for full mobile control)

## Tradeoffs I'm accepting

- Users need a Spotify account (free or Premium)
- Spotify Free users get ads and limited mobile control
- I can't curate the listening experience as tightly (Spotify's player UI takes over for actual playback on mobile)
- If Spotify changes their API terms, my app could be affected
- Less "ownership" of the product than self-hosting

## Tech stack

- **Frontend:** React Native + Expo (cross-platform iOS + Android)
- **Spotify integration:**f - `react-native-spotify-remote` for native playback control on mobile
  - Spotify Web API for search, metadata, playlist management
- **Auth:** Spotify OAuth (Authorization Code with PKCE flow)
- **Backend:** Supabase free tier for storing curated catalog data and user-generated content
- **Catalog data:** JSON to start, migrate to Supabase as it grows

## Spotify API specifics

### Two flows I'll need:

1. **Client Credentials flow** (for app's own searches)
   - Used to populate the curated catalog
   - No user login needed
   - Can search Spotify and get track metadata

2. **Authorization Code with PKCE** (for users)
   - User logs in with their Spotify account
   - Required for playback control and user playlists
   - Standard OAuth 2.0 with PKCE for mobile security

### Required Spotify scopes:
- `streaming` - play music through the SDK
- `user-read-email` - identify the user
- `user-read-private` - get user's country/subscription tier
- `user-library-read` and `user-library-modify` - access "Liked Songs"
- `playlist-read-private` and `playlist-modify-private` - manage user playlists
- `user-modify-playback-state` - control playback

### Important Spotify API limits:
- Need to register the app at developer.spotify.com
- Starts in "Development Mode" - limited to 25 users until quota extension is approved
- Need to apply for "Extended Quota Mode" for public release
- Application requires demo video, privacy policy, terms of service

## Catalog strategy

### How songs get into the app:

1. **Manual curation** (start here)
   - I research and tag Spotify tracks with Psalm numbers/themes
   - Use Spotify's search API to find candidates
   - Maintain a JSON/database of: track_id, psalm_number(s), theme, notes
   
2. **Algorithmic discovery** (later)
   - Search Spotify for "Psalm 23", "Psalm 91", etc.
   - Filter by relevance (artist genre, album context)
   - Surface to me for review/approval before adding

3. **Community submissions** (later)
   - Users submit Spotify links they think fit
   - I review and add to the official catalog

### Curated artists to seed the catalog:
- Shane & Shane (Psalms vol. 1-3)
- Wendell Kimbrough
- The Corner Room
- Sons of Korah
- Sandra McCracken
- The Psalms Project
- My Soul Among Lions
- Cardiphonia
- Indelible Grace (some Psalm-based hymns)

## App features (v1)

- **Spotify login** - clean OAuth flow with PKCE
- **Browse all 150 Psalms** - tap a Psalm number, see all curated songs
- **Theme-based browsing** - Praise, Lament, Thanksgiving, Confidence, Kingship, Remembrance, Wisdom
- **Artist directory** - browse by artist
- **Featured playlists** - curated collections (e.g., "Psalms for Mourning", "Morning Psalms", "Songs of Ascent")
- **Play directly via Spotify** - in-app playback using Spotify SDK
- **Save to user's Spotify Liked Songs** - tap heart, song saves to their actual Spotify library
- **Add to Spotify playlist** - "Add to playlist" creates/updates a playlist in their Spotify account
- **Search** - within the curated catalog
- **Submit a song** - users can suggest Spotify tracks to add

## Future features (v2+)

- Daily Psalm + song pairing (push notification with reading + song)
- Multi-translation Psalm text alongside music
- User-created public playlists shared with community
- Topic-based playlists ("Psalms about anxiety", "Psalms for sleep")
- Artist deep-dives with bio and full Psalm-related discography
- Reading plans tied to listening (e.g., "Pray the Psalter in 30 days")

## Cost estimate

- Spotify Web API: $0
- Supabase free tier: $0
- Apple Developer: $99/year
- Google Play: $25 one-time
- **Total ongoing: ~$8/month average**

## What I need help with first

[Update with what to tackle first - suggestions:]
- Setting up the Expo project structure
- Registering the Spotify Developer app
- Building the OAuth + PKCE flow
- Designing the catalog data schema
- Building the Psalm browser UI
- Curating the initial seed catalog

## App name

[Top contenders: Selah, Psalter, 150]

## Notes from prior conversation

- I can code (so don't dumb down explanations)
- Goal is free community resource (not a business)
- Web app would be easier but I want mobile (iOS/Android via React Native)
- Already explored and ruled out: 
  - YouTube (no background audio in 3rd-party apps)
  - Amazon Music (closed beta API, no SDK)
  - Self-hosting (more work, doing this Spotify version first as faster path to launch)

## Spotify-specific gotchas to remember

1. **Free vs Premium users behave differently** - Free users have playback restrictions. Test both flows.
2. **iOS Spotify SDK is a separate library from Android** - `react-native-spotify-remote` wraps both but expect platform-specific issues.
3. **The 25-user limit is real** - plan for extended quota application before public launch.
4. **Spotify SDK on mobile requires the Spotify app to be installed** - users without Spotify installed can't play. Need to handle this gracefully.
5. **PKCE is required for mobile apps** - don't use the older Implicit Grant flow (deprecated).
6. **Token refresh is your responsibility** - access tokens expire in 1 hour, need to refresh using refresh token.
7. **Track URIs vs IDs** - Spotify uses `spotify:track:abc123` URI format for playback, but `abc123` track ID for API calls. Easy to mix up.
