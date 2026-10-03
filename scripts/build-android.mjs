import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, X509Certificate } from 'node:crypto';
const root = resolve(import.meta.dirname,'..');
const device = process.argv.includes('--device');
const distribution = process.argv.includes('--distribution');
if (device === distribution) throw new Error('Choose --device or --distribution.');
function run(command,args,options={}) {
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});
  if(result.status!==0) throw new Error(`${command} failed (${result.status ?? 'unavailable'})`);
  return result;
}
let expectedFingerprint;
if(distribution){
  const file=resolve(root,'credentials.json');
  if(!existsSync(file)) throw new Error('Run npm run android:signing-setup first.');
  if((statSync(file).mode & 0o077)!==0) throw new Error('credentials.json must be owner-only (chmod 600).');
  const key=JSON.parse(readFileSync(file,'utf8')).android.keystore;
  if((statSync(resolve(root,key.keystorePath)).mode & 0o077)!==0) throw new Error('The keystore must be owner-only.');
  const cert=run('keytool',['-exportcert','-keystore',resolve(root,key.keystorePath),'-alias',key.keyAlias,
    '-storepass:env','SCOUTVY_KEY_PASSWORD'],{stdio:'pipe',env:{...process.env,SCOUTVY_KEY_PASSWORD:key.keystorePassword}}).stdout;
  expectedFingerprint=new X509Certificate(cert).fingerprint256.replaceAll(':','').toLowerCase();
}
run(process.execPath,[resolve(root,'node_modules/expo/bin/cli'),'prebuild','--platform','android','--no-install']);
const env={...process.env,SCOUTVY_DEVICE_BUILD:device?'1':'0'};
run('./gradlew',['app:assembleRelease',...(distribution?['app:bundleRelease']:[]),'-x','test','--configure-on-demand',
  '--build-cache','--max-workers=2','--no-parallel','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m',
  '-PreactNativeArchitectures=arm64-v8a'],{cwd:resolve(root,'android'),env});
const apk=resolve(root,'android/app/build/outputs/apk/release/app-release.apk');
const sdk=process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? resolve(process.env.HOME,'Library/Android/sdk');
const buildTools=readdirSync(resolve(sdk,'build-tools')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
const apksigner=buildTools.map(v=>resolve(sdk,'build-tools',v,'apksigner')).find(existsSync);
if(!apksigner) throw new Error('Android apksigner is required to verify the output.');
const certificate=run(apksigner,['verify','--print-certs',apk],{stdio:'pipe',encoding:'utf8'}).stdout;
const fingerprint=certificate.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1]?.toLowerCase();
if(!fingerprint) throw new Error('APK signing certificate was not found.');
if(distribution && fingerprint!==expectedFingerprint) throw new Error('APK does not match the configured upload key.');
if(device && fingerprint!=='fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c') throw new Error('Device build signing key changed; do not overwrite the installed app.');
const out=resolve(root,'artifacts/android');mkdirSync(out,{recursive:true});
const name=device?'scoutvy-device':'scoutvy-devnet-signed';
copyFileSync(apk,resolve(out,`${name}.apk`));
const files=[{name:`${name}.apk`,sha256:createHash('sha256').update(readFileSync(apk)).digest('hex')}];
if(distribution){
  const bundle=resolve(root,'android/app/build/outputs/bundle/release/app-release.aab');
  run('jarsigner',['-verify',bundle],{stdio:'pipe'});
  const bundleCertificate=run('keytool',['-printcert','-rfc','-jarfile',bundle],{stdio:'pipe',encoding:'utf8'}).stdout;
  const bundlePem=bundleCertificate.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
  if(!bundlePem || new X509Certificate(bundlePem).fingerprint256.replaceAll(':','').toLowerCase()!==expectedFingerprint) {
    throw new Error('AAB does not have the configured upload-key signature.');
  }
  copyFileSync(bundle,resolve(out,`${name}.aab`));
  files.push({name:`${name}.aab`,sha256:createHash('sha256').update(readFileSync(bundle)).digest('hex')});
}
writeFileSync(resolve(out,`${name}.json`),JSON.stringify({builtAt:new Date().toISOString(),network:'devnet',architecture:'arm64-v8a',certificateSha256:fingerprint,files},null,2)+'\n');
console.log(`Verified ${name}: ${out}. No installation or store upload performed.`);
