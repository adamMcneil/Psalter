# Psalms Music App - Project Brief

## What I'm building

A free, non-commercial mobile app (iOS + Android) that helps people discover and listen to music based on the Psalms. Think of it as a focused, ad-free listening experience for Psalm-based worship music. This is a ministry/community resource - no monetization planned.

## Key decisions already made

- **Platform:** React Native with Expo (mobile-first, cross-platform)
- **Approach:** Self-hosted audio (NOT Spotify, Apple Music, Amazon Music, or YouTube)
- **Why self-hosted:** Major streaming APIs are too restrictive for a third-party mobile app - YouTube blocks background audio in third-party apps, Amazon Music API is closed beta, Spotify requires users to have Spotify accounts. Self-hosting gives full control, real native audio experience (background play, lock screen controls, offline support), and no third-party gatekeeper.
- **Goal:** Free community resource, not a business

## Audio sources strategy

1. **Direct artist permissions** - email Psalm-focused artists asking permission for non-commercial inclusion. Priority list:
   - Poor Bishop Hooper (EveryPsalm - all 150 Psalms covered)
   - Wendell Kimbrough
   - The Corner Room
   - Sons of Korah
   - Sandra McCracken
   - Shane & Shane
   - The Psalms Project
   - My Soul Among Lions
   - Cardiphonia

2. **Creative Commons / public domain** - Free Music Archive, Internet Archive, Musopen, Wikimedia Commons. Good for traditional chant and classical Psalm settings (Bach, Handel, Mendelssohn, etc.)

3. **Commissioned recordings** (later) - hire local musicians to record public domain compositions

**IMPORTANT:** "Free download" on an artist's site does NOT mean permission to redistribute in an app. Always get explicit written permission.

## Tech stack

- **Frontend:** React Native + Expo
- **Audio playback:** react-native-track-player (handles background audio, lock screen controls, native experience)
- **Storage:** Cloudflare R2 (free tier covers 10GB; no egress fees - critical for streaming)
- **Database:** Supabase (free tier) for catalog metadata, user accounts (later), playlists
- **Catalog data:** JSON file initially, migrate to Supabase as it grows

## Cost estimate

- Cloudflare R2: $0/month at this scale
- Supabase: $0/month free tier
- Apple Developer: $99/year
- Google Play: $25 one-time
- **Total ongoing: ~$8/month average**

## App features (v1)

- Browse all 150 Psalms by number
- Each Psalm shows available songs with artist, length, license info
- Audio player with background playback, lock screen controls
- Favorites (stored locally first, synced later)
- Search by Psalm number, artist, or theme
- Theme-based browsing (Praise, Lament, Thanksgiving, Confidence, Kingship, Remembrance, Wisdom)
- Artist credits prominent on every track
- Submit-a-song form for community suggestions

## Future features (v2+)

- User accounts and cross-device sync
- User-created playlists
- Offline downloads
- Community-curated playlists
- Daily Psalm reading + song pairing
- Multiple translations of Psalm text alongside music

## What I need help with first

[Update this with what you want to tackle first - suggestions:]
- Setting up the Expo project structure
- Building the audio player component
- Designing the catalog data schema
- Setting up Cloudflare R2
- Creating the artist outreach email template
- Designing the UI/visual identity

## App name

[Still deciding - top contenders: Selah, Psalter, 150]

## Notes from prior conversation

- I can code (so don't dumb down explanations)
- Goal is free community resource
- Already explored and ruled out: Spotify (works but requires user accounts), YouTube (no background audio in 3rd-party apps), Amazon Music (closed beta API, no SDK)
- Self-hosting is the chosen path
