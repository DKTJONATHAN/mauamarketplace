import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { format: 'jwk' },
  privateKeyEncoding: { format: 'jwk' },
});
const bytes = Buffer.from([4, ...Buffer.from(publicKey.x, 'base64url'), ...Buffer.from(publicKey.y, 'base64url')]);
console.log(JSON.stringify({
  VAPID_PUBLIC_KEY: bytes.toString('base64url'),
  VAPID_PRIVATE_JWK: JSON.stringify(privateKey),
}, null, 2));
