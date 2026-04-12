export const envSchema = {
  type: 'object',
  required: [
    'PORT',
    'API_URL',
    'DATABASE_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'REDIS_URL',
    'GITHUB_CACHE_TTL_SECONDS',
  ],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    API_URL: {
      type: 'string',
    },
    DATABASE_URL: {
      type: 'string',
    },
    GITHUB_TOKEN: {
      type: 'string',
    },
    SMTP_HOST: {
      type: 'string',
    },
    SMTP_PORT: {
      type: 'number',
    },
    SMTP_USER: {
      type: 'string',
    },
    SMTP_PASSWORD: {
      type: 'string',
    },
    SCAN_INTERVAL_MS: {
      type: 'number',
      default: 600000,
    },
    SCAN_ENABLED: {
      type: 'boolean',
      default: true,
    },
    REDIS_URL: {
      type: 'string',
    },
    GITHUB_CACHE_TTL_SECONDS: {
      type: 'number',
      default: 600,
    },
  },
};