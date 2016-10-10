export default {
  id: 'auth-response-data',
  type: 'object',
  properties: {
    accessor: {
      type: 'string',
    },
    client_token: {
      type: 'string',
    },
    lease_duration: {
      type: 'integer',
      minimum: 0,
    },
    metadata: {
      type: 'object',
    },
    policies: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    renewable: {
      type: 'boolean',
    },
  },
  required: [
    'client_token',
  ],
};
