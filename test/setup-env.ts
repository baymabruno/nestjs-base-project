process.env.JWT_KEY ??= 'e2e-test-key';
process.env.JWT_EXPIRES_IN ??= '3600';
// the e2e tests simulate a reverse proxy with X-Forwarded-For
process.env.TRUST_PROXY ??= '1';
