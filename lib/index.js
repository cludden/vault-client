import Ajv from 'ajv';
import axios from 'axios';
import Baobab from 'baobab';
import Bluebird from 'bluebird';
import EventEmitter from 'eventemitter2';
import lt from 'long-timeout';
import retry from 'retry';
import _ from 'lodash';

import schemas from './schemas';

export default class Vault extends EventEmitter {
  constructor(options) {
    super();

    // instantiate validator and load schemas
    this.ajv = new Ajv({
      v5: true,
      useDefaults: true,
      coerceTypes: true,
      loadSchema: this._loadSchema.bind(this),
    });
    Object.keys(schemas).forEach(s => this.ajv.addSchema(s));

    // validate constructor options
    if (!this.ajv.validate('constructor-options', options)) {
      const err = new Error('Validation Error');
      err.errors = this.ajv.errors.slice();
      throw err;
    }
    this.log = _.isFunction(options.log) ? options.log : _.noop;
    this.renewals = {};

    this.client = axios.create({
      baseURL: options.url,
    });

    this.client.interceptors.request.use((config) => {
      const token = _.get(this, '_auth.token');
      if (token) {
        _.merge(config, { headers: { 'X-Vault-Token': token } });
      }
      return config;
    });

    this.store = new Baobab({});
  }

  /**
   * Validate a value against a known schema
   * @param {String} id - schema id
   * @param {*} val - the value to validate
   * @return {Bluebird} bluebird
   */
  validate(id, val) {
    return Bluebird.try(() => {
      const validate = this.ajv.getSchema(id);
      if (!validate(val)) {
        const err = new Error('Validation Error');
        err.errors = validate.errors.slice();
        throw err;
      }
      return val;
    });
  }

  /**
   * Fetch one or more secrets and cache them in the store. If secrets include
   * a lease_duration greater than 0, handle renewing each secret when the
   * lease_duration expires
   * @param {Object|Object[]|String|String[]} secrets
   * @param {Object} [retryOptions]
   * @return {Bluebird} bluebird
   */
  watch(secrets, retryOptions = {}) {
    return this.validate('retry-options', retryOptions)
    .then(() => this.validate('watch-secrets', secrets))
    .then((s) => {
      return Array.isArray(s) ? s : [s];
    })
    .each(s => this._watch(s, retryOptions))
    .then(() => this.secret());
  }

  /**
   * Watch a single secret
   * @param {Object|String} secret
   * @param {Object} [retryOptions]
   * @return {Bluebird} bluebird
   */
  _watch(secret, retryOptions = {}) {
    return new Bluebird((resolve, reject) => {
      const path = _.isString(secret) ? secret : secret.path;
      const address = _.isString(secret) ? secret : secret.address || secret.path;

      // clear pending renewal
      if (_.has(this, `renewals.${path}`)) {
        lt.clearTimeout(this.renewals[path]);
      }

      const operation = retry.operation(retryOptions);
      operation.attempt(() => {
        this.get(path)
        .catch((err) => {
          // if request is invalid, abort
          if (err.response.status < 500) {
            operation.stop();
          }
          // otherwise retry
          if (operation.retry(err)) {
            return;
          }
          this.emit('error', err);
          return reject(err);
        })
        .then((data) => {
          // handle renewal
          if (_.isNumber(data.lease_duration) && data.lease_duration > 0) {
            const timeout = data.lease_duration * 1000;
            const renew = () => this._watch(secret, retryOptions);
            this.renewals[path] = lt.setTimeout(renew, timeout);
          }

          // cache secret
          if (this.store.get(address)) {
            this.store.deepMerge(address, data.data);
          } else {
            this.store.set(address, data.data);
          }

          return this.store.get(address);
        });
      });
    });
  }
}
