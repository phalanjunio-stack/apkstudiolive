// Adiciona as permissões de câmera/áudio no AndroidManifest gerado pelo Capacitor,
// pra o getUserMedia (câmera/mic) funcionar no WebView do app.
import fs from 'node:fs';

const f = 'android/app/src/main/AndroidManifest.xml';
let m = fs.readFileSync(f, 'utf8');

if (!m.includes('android.permission.CAMERA')) {
  const perms = [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
  ].map((p) => `    <uses-permission android:name="${p}" />`).join('\n');

  m = m.replace('<application', perms + '\n\n    <application');
  // câmera não obrigatória (não exclui aparelhos sem câmera traseira)
  m = m.replace('</manifest>', '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
  fs.writeFileSync(f, m);
  console.log('Manifest: permissões de câmera/áudio adicionadas.');
} else {
  console.log('Manifest: permissões já presentes.');
}
