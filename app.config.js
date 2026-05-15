const baseUrl = process.env.EXPO_BASE_URL;

module.exports = {
  expo: {
    name: "Psalter",
    slug: "psalter",
    version: "0.1.0",
    orientation: "portrait",
    scheme: "psalter",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    plugins: ["expo-router", "expo-web-browser"],
    experiments: {
      typedRoutes: true,
      ...(baseUrl ? { baseUrl } : {}),
    },
    extra: {
      SPOTIFY_CLIENT_ID: "750204e46dfa414988d5776ad9196988",
    },
  },
};
