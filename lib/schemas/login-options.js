export default {
  id: 'login-options',
  type: 'object',
  properties: {
    backend: {
      type: 'string',
      enum: [
        'app-role',
        'github',
        'userpass',
      ],
    },
    options: {
      type: 'object',
    },
    retry: {
      $ref: 'retry-options',
    },
  },
  required: [
    'backend',
  ],
};
