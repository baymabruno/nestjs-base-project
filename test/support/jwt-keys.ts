import { generateKeyPairSync } from 'crypto';

/** Generates an RSA key pair encoded as expected by JWT_PRIVATE_KEY / JWT_PUBLIC_KEY */
export const generateJwtKeys = () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  return {
    JWT_PRIVATE_KEY: Buffer.from(privateKey).toString('base64'),
    JWT_PUBLIC_KEY: Buffer.from(publicKey).toString('base64'),
  };
};
