export const envSchema = {
  type: 'object',
  required: [
    'PORT',
    'DATABASE_URL',
  ],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    DATABASE_URL: {
      type: 'string',
    },
  },
};