import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..');
const credentialsFile = resolve(root,'credentials.json');
const keystorePath = 'credentials/scoutvy-android-upload.jks';
if (existsSync(credentialsFile)) {
  console.log('Existing Android signing credentials preserved.');
  process.exit(0);
}
if (existsSync(resolve(root,keystorePath))) throw new Error('A keystore already exists; recover its credentials instead of replacing it.');
mkdirSync(resolve(root,'credentials'),{recursive:true,mode:0o700});
const password = randomBytes(32).toString('base64url');
const keyAlias = 'scoutvy-upload';
const result = spawnSync('keytool',['-genkeypair','-keystore',resolve(root,keystorePath),'-alias',keyAlias,
  '-storetype','JKS','-keyalg','RSA','-keysize','3072','-sigalg','SHA256withRSA','-validity','10000',
  '-dname','CN=Scoutvy Android Upload','-storepass:env','SCOUTVY_KEY_PASSWORD','-keypass:env','SCOUTVY_KEY_PASSWORD','-noprompt'],
  {env:{...process.env,SCOUTVY_KEY_PASSWORD:password},encoding:'utf8'});
if (result.status !== 0) throw new Error('Android key generation failed; no credentials were printed.');
chmodSync(resolve(root,keystorePath),0o600);
writeFileSync(credentialsFile,JSON.stringify({android:{keystore:{keystorePath,keystorePassword:password,keyAlias,keyPassword:password}}},null,2)+'\n',{flag:'wx',mode:0o600});
console.log('Private Android upload key created. Keep credentials.json and credentials/scoutvy-android-upload.jks backed up together.');
