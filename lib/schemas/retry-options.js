export default {
  id: 'retry-options',
  type: 'object',
  properties: {
    factor: {
      $ref: 'positive-int',
      default: 2,
    },
    forever: {
      type: 'boolean',
      default: false,
    },
    maxTimeout: {
      $ref: 'timeout',
      default: 10000,
    },
    minTimeout: {
      $ref: 'timeout',
      default: 1000,
    },
    retries: {
      $ref: 'positive-int',
      default: 10,
    },
  },
  definitions: {
    'positive-int': {
      type: 'integer',
      minimum: 1,
    },
    timeout: {
      oneOf: [
        { $ref: '#/definitions/positive-int' },
        { type: 'string' },
      ],
    },
  },
};
