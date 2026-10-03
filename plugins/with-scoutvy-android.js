const { withAndroidManifest, withDangerousMod, withAppBuildGradle, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const begin = '// @scoutvy-signing-start';
const end = '// @scoutvy-signing-end';
const signing = `${begin}
def scoutvyDeviceBuild = System.getenv('SCOUTVY_DEVICE_BUILD') == '1'
def scoutvyCredentialsFile = rootProject.file('../credentials.json')
if (!scoutvyDeviceBuild && scoutvyCredentialsFile.exists()) {
    def scoutvyCredentials = new groovy.json.JsonSlurper().parse(scoutvyCredentialsFile).android.keystore
    def scoutvyKeyFile = new File(scoutvyCredentials.keystorePath)
    if (!scoutvyKeyFile.isAbsolute()) scoutvyKeyFile = rootProject.file('../' + scoutvyCredentials.keystorePath)
    android.signingConfigs.create('scoutvyUpload') {
        storeFile scoutvyKeyFile
        storePassword scoutvyCredentials.keystorePassword
        keyAlias scoutvyCredentials.keyAlias
        keyPassword scoutvyCredentials.keyPassword ?: scoutvyCredentials.keystorePassword
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.scoutvyUpload
}
gradle.taskGraph.whenReady { graph ->
    def scoutvyRelease = graph.allTasks.any { it.path in [':app:packageRelease', ':app:signReleaseBundle'] }
    if (scoutvyRelease && !scoutvyDeviceBuild && android.buildTypes.release.signingConfig == android.signingConfigs.debug) {
        throw new GradleException('Scoutvy release signing is missing. Configure credentials.json or use npm run android:device-build for the existing emulator.')
    }
}
${end}`;
module.exports = function withScoutvyAndroid(config) {
  config = withAppBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') throw new Error('Scoutvy signing requires the generated Groovy build file');
    const start = config.modResults.contents.indexOf(begin);
    if (start !== -1) {
      const finish = config.modResults.contents.indexOf(end, start);
      if (finish === -1) throw new Error('Incomplete Scoutvy signing block');
      config.modResults.contents = config.modResults.contents.slice(0,start) + config.modResults.contents.slice(finish + end.length);
    }
    config.modResults.contents = config.modResults.contents.trimEnd() + '\n\n' + signing + '\n';
    return config;
  });
  config = withDangerousMod(config, ['android', async config => {
    const res = path.join(config.modRequest.platformProjectRoot,'app/src/main/res');
    for (const dir of ['drawable','drawable-nodpi','drawable-anydpi-v26','values']) await fs.mkdir(path.join(res,dir),{recursive:true});
    // Reuse the existing mark unchanged. Native drawable insets keep the complete
    // silhouette inside Android's 66dp safe zone on a 108dp adaptive canvas.
    await fs.copyFile(path.join(config.modRequest.projectRoot,'assets/images/scoutvy-splash.png'),path.join(res,'drawable-nodpi/scoutvy_mark.png'));
    await fs.writeFile(path.join(res,'values/scoutvy_icon.xml'),'<resources><color name="scoutvy_icon_background">#AB9FF3</color></resources>');
    await fs.writeFile(path.join(res,'drawable/scoutvy_mark_inset.xml'),'<inset xmlns:android="http://schemas.android.com/apk/res/android" android:inset="20%"><bitmap android:src="@drawable/scoutvy_mark" android:gravity="fill" android:filter="true" /></inset>');
    await fs.writeFile(path.join(res,'drawable/scoutvy_launcher.xml'),'<layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item android:drawable="@color/scoutvy_icon_background"/><item android:drawable="@drawable/scoutvy_mark_inset"/></layer-list>');
    await fs.writeFile(path.join(res,'drawable-anydpi-v26/scoutvy_launcher.xml'),'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/scoutvy_icon_background"/><foreground android:drawable="@drawable/scoutvy_mark_inset"/><monochrome android:drawable="@drawable/scoutvy_mark_inset"/></adaptive-icon>');
    return config;
  }]);
  return withAndroidManifest(config, config => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app.$['android:icon'] = '@drawable/scoutvy_launcher';
    app.$['android:roundIcon'] = '@drawable/scoutvy_launcher';
    return config;
  });
};
