'use strict';

const async = require('async');
const backends = require('./backends');
const joi = require('joi');
const lt = require('long-timeout');
const retry  = require('retry');
const _ = require('lodash');

module.exports = {
    /**
     * Authenticate with vault.
     * @param  {Object} options
     * @param  {String} options.backend - ['userpass']
     * @param  {Function} [cb]
     */
    login(options, cb) {
        const self = this;
        const _async = _.isFunction(cb);

        // if this is a renewal, grab prior login options
        if (!options) {
            options = _.get(self, '_auth.login');
        }

        // clear any pending renewals
        if (_.has(self, '_auth.renewal')) {
            lt.clearTimeout(self._auth.renewal);
            delete self._auth.renewal;
        }

        async.auto({
            // validate options
            options: function validateOptions(fn) {
                const schema = joi.object({
                    backend: joi.string().valid([
                        'userpass'
                    ]).required(),
                    options: joi.object().required(),
                    retry: joi.object()
                }).unknown(true).required();
                joi.validate(options, schema, function(err, validated) {
                    if (err) {
                        err = new Error(`Invalid Login Options: ${err.messsage}`);
                        return fn(err);
                    }
                    _.set(self, '_auth.login', options);
                    fn(null, validated);
                });
            },

            // attempt to authenticate with vault server, retry with
            // exponential backoff in case of non authentication errors
            data: ['options', function authenticate(fn, r) {
                const backend = backends[options.backend];
                const ops = r.options;
                const operation = retry.operation(ops.retry);

                operation.attempt(function() {
                    backend.login(self, ops.options, function(err, auth) {
                        console.log(err);
                        if (err) {
                            const errCode = _.get(err, 'message');
                            const defaultStatus = /timeout/.test(errCode) ? 503 : 499;
                            const status = _.get(err, 'status', defaultStatus);
                            if (status >= 400 && status <= 499) {
                                if (operation._timeout) {
                                    clearTimeout(operation._timeout);
                                }
                                operation._timeouts = [];
                                if (status === 400 && status === 401) {
                                    err = new Error(`Incorrect username/password combination`);
                                    err.type = 'ERROR:LOGIN';
                                }
                                return fn(err);
                            }
                            if (operation.retry(err)) {
                                return;
                            }
                            err = operation.mainError() || err;
                            return fn(err);
                        }

                        fn(null, auth);
                    });
                });
            }],

            auth: ['data', function validateAuth(fn, r) {
                const data = r.data;
                joi.validate(data, joi.object({
                    client_token: joi.string().required(),
                    lease_duration: joi.number().integer().min(0).required()
                }).unknown(true).required(), fn);
            }],

            // finish login process
            login: ['auth', function finishLogin(fn, r) {
                const auth = r.auth;

                self.status = 'authenticated';
                _.set(self, '_auth.token', auth.client_token);
                if (auth.lease_duration > 0) {
                    self._auth.renewal = lt.setTimeout(function() {
                        self.status = 'unauthenticated';
                        self.login.call(self);
                    }, auth.lease_duration * 1000);
                }
                async.setImmediate(fn);
            }]
        }, function(err) {
            if (err) {
                self.emit('error:login', err);
                if (_async) {
                    cb(err);
                }
                return;
            }
            self.emit('authenticated');
            if (_async) {
                cb();
            }
        });
    }
};
