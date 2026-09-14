// Expo config plugin: restrict the APK to the given ABIs.
// expo-build-properties' buildArchs only affects modules built from source;
// prebuilt AARs (Hermes, react-android) still ship every ABI unless
// ndk.abiFilters is set in app/build.gradle.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withAbiFilters(config, { abis = ['arm64-v8a'] } = {}) {
  return withAppBuildGradle(config, (mod) => {
    const list = abis.map((a) => `"${a}"`).join(', ');
    const block = `ndk {\n            abiFilters ${list}\n        }\n`;
    if (!mod.modResults.contents.includes('abiFilters')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /(defaultConfig\s*\{\n)/,
        `$1        ${block}`,
      );
    }
    return mod;
  });
};
