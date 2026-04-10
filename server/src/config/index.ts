export const envSchema = {
  type: 'object',
  required: [
    'PORT',
  ],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
  },
};