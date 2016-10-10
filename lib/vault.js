

const async = require('async');
const auth = require('./auth');
const axios = require('axios');
const EventEmitter = require('events').EventEmitter;
const joi = require('joi');
const lt = require('long-timeout');
const retry = require('retry');
const util = require('util');
const _ = require('lodash');


/**
* Client constructor function.
* @param {Object} options
* @param {Object} [options.retry] - global retry options for vault http requests
* @param {String} options.url - the url of the vault server
*/
function Vault(options) {
  EventEmitter.call(this);
  const self = this;

  /**
  * Define a private store for caching secrets
  * @type {Object}
  * @private
  */
  const store = {};


  /**
  * Define a container for storing pending renewals
  * @type {Object}
  */
  self.renewals = {};


  // validate constructor options
  joi.assert(options, joi.object({
    url: joi.string().uri({ relative: true }).required(),
    retry: joi.object(),
  }).unknown(true).required());
  self.options = options;


  // define initial status
  self.status = 'unauthenticated';


  // create new http client
  self.client = axios.create({
    baseURL: options.url,
  });


  // if an auth token is available, set it on every request
  // as the 'X-Vault-Token' header
  self.client.interceptors.request.use((config) => {
    const token = _.get(self, '_auth.token');
    if (token) {
      _.merge(config, {
        headers: {
          'X-Vault-Token': token,
        },
      });
    }
    return config;
  });


  /**
  * Fetch a copy of all or a portion of the store.
  * @param  {String} [path]
  * @return {*}
  */
  self.secret = function (path) {
    if (!path) {
      const result = _.cloneDeep(store);
      return result;
    }
    const result = _.get(store, path);
    if (!result) {
      return;
    }
    return _.cloneDeep(result);
  };


  /**
  * Fetch one or more secrets and cache them in the store. If
  * secrets include a lease_duration greater than 0, handle renewing
  * each secret when lease_duration's expire
  * @param  {Object|Object[]|String|String[]} secrets
  * @param  {Object} [options]
  * @param  {Function} [cb]
  */
  self.watch = function (secrets, options, cb) {
    // handle optional 'options' argument
    if (_.isFunction(options)) {
      cb = options;
      options = {};
    }

    // handle optional callback
    if (!_.isFunction(cb)) {
      cb = function () {};
    }

    async.waterfall([
      // validate secrets arg
      function validateSecrets(next) {
        const schema = joi.array().items(
          joi.string().uri({ allowRelative: true }),
          joi.object({
            id: joi.string(),
            path: joi.string().uri({ allowRelative: true }).required(),
          })
        ).single().required();
        joi.validate(secrets, schema, (err, validated) => {
          if (err) {
            self.emit('error', err);
          }
          next(err, validated);
        });
      },

      // fetch secrets
      function fetchSecrets(validated, next) {
        async.reduce(validated, {}, (memo, secret, done) => {
          self._watch(secret, options, (err, data) => {
            if (err) {
              return done(err);
            }
            _.merge(memo, data);
            done(null, memo);
          });
        }, next);
      },
    ], cb);
  };


  /**
  * Watch a single secret and store it in the cache.
  * @param  {String|Object} path
  * @param  {Object} options
  * @param  {Function} cb
  * @private
  */
  self._watch = function watchSecret(secret, options, cb) {
    // handle optional callback
    if (!_.isFunction(cb)) {
      cb = function () {};
    }

    // determine appropriate path and id
    let path, id;
    if (_.isString(secret)) {
      path = secret;
      id = secret;
    } else {
      path = secret.path;
      id = secret.id ? secret.id : secret.path;
    }

    // clear any pending renewal
    if (_.has(self.renewals, id)) {
      lt.clearTimeout(self.renewals[id]);
      delete self.renewals[id];
    }

    const retryOptions = _.merge({}, self.options.retry, options.retry);
    const operation = retry.operation(retryOptions);
    operation.attempt(() => {
      self.get.call(self, path, (err, data) => {
        // handle error
        if (err) {
          self.emit('error', err);
          if (operation.retry(err)) {
            return;
          }
          const mainError = operation.mainError();
          const e = mainError ? mainError : err;
          return cb(e);
        }

        // handle renewal
        if (_.isNumber(data.lease_duration) && data.lease_duration > 0) {
          self.renewals[id] = lt.setTimeout(() => {
            watchSecret.call(self, secret, options);
          }, data.lease_duration * 1000);
        }

        // store secret
        const secretData = data.data;
        if (_.has(store, id)) {
          _.merge(store[id], secretData);
        } else {
          store[id] = secretData;
        }

        // return result and notify listeners of renewal
        const result = self.secret(id);
        cb(null, { [id]: result });
        self.emit(`secret:${id}`, result);
        self.emit('secret', id, result);
      });
    });
  };
}

util.inherits(Vault, EventEmitter);


/**
* Override vault http methods, adding support for node style callbacks
*/
['delete', 'head', 'get', 'post', 'path', 'put'].forEach((method) => {
  Vault.prototype[method] = function (...args) {
    const self = this;
    let cb;
    if (_.isFunction(args[args.length - 1])) {
      cb = args.pop();
    }
    if (cb) {
      self.client[method].apply(self.client, args).then((res) => {
        const data = _.get(res, 'data');
        const err = _.attempt(() => {
          cb(null, data);
        });
        if (err) {
          self.emit('error', err);
        }
      }).catch((res) => {
        const status = _.get(res, 'status', 500);
        const msg = _.get(res, 'data') || _.get(res, 'message');
        const err = new Error(`Vault API Error: ${JSON.stringify(msg)}`);
        err.status = status;
        self.emit('error', err);
        cb(err);
      });
    } else {
      return self.client[method].apply(self.client, args);
    }
  };
});

Vault.prototype.login = auth.login;

Vault.prototype.logout = auth.logout;

module.exports = Vault;
