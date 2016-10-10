export default {
  id: 'watch-secrets',
  type: 'array',
  items: {
    anyOf: [
      {
        type: 'string',
      },
      {
        type: 'object',
        properties: {
          address: {
            type: 'string',
          },
          path: {
            type: 'string',
          },
        },
        required: [
          'path',
        ],
      },
    ],
  },
};
