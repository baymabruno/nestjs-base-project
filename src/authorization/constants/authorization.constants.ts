// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

export const jwtConstants = {
  secret: process.env.JWT_KEY,
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN),
};
