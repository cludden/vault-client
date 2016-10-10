export default {
  id: 'auth-userpass-options',
  type: 'object',
  properties: {
    password: {
      type: 'string',
    },
    username: {
      type: 'string',
    },
  },
  required: [
    'password',
    'username',
  ],
};
