'use strict';

const async = require('async');
const axios = require('axios');
const joi = require('joi');
const _ = require('lodash');

const SIGNATURE_ENDPOINT = 'http://169.254.169.254/latest/dynamic/instance-identity/pkcs7';

module.exports = {
    /**
     * Login from aws ec2 instance
     * @param  {Object} vault
     * @param  {Object} options
     * @param  {Function|String} [options.nonce] - either a nonce or a function that returns a nonce
     * @param  {Function} cb
     */
    login(vault, options, cb) {
        async.auto({
            // validate 'options' arg
            options: function validateOptions(fn) {
                const schema = joi.object({
                    nonce: joi.alternatives().try(
                        joi.string(),
                        joi.func().maxArity(1)
                    ),
                    role: joi.string()
                }).unknown(true).required();
                joi.validate(options, schema, fn);
            },

            // fetch the nonce if applicable
            nonce: ['options', function getNonce(fn, r) {
                const validated = r.options;
                if (!validated.nonce || typeof validated.nonce === 'string') {
                    return async.setImmediate(function()  {
                        fn(null, validated.nonce);
                    });
                }
                // handle synchronous nonce method
                if (validated.nonce.length === 0) {
                    return async.setImmediate(function() {
                        const err = _.attempt(function() {
                            validated.nonce = validated.nonce();
                        });
                        if (_.isError(err)) {
                            return fn(err);
                        }
                        fn(null, validated.nonce);
                    });
                }
                // handle asynchronous nonce method
                validated.nonce(function(err, nonce) {
                    if (err) {
                        return fn(err);
                    }
                    validated.nonce = nonce;
                    fn(null, validated.nonce);
                });
            }],

            // fetch the AWS pkcs7 signature for the instance identity document
            pkcs7: ['options', function getSignature(fn) {
                axios.get(SIGNATURE_ENDPOINT)
                .then(function(res) {
                    const pkcs7 = res.data;
                    fn(null, pkcs7.replace('\n', ''));
                })
                .catch(function(res) {
                    const err = new Error(`Unable to fetch identity document pkcs7 signature from AWS api: GET to ${SIGNATURE_ENDPOINT} failed with status ${res.status} and body ${JSON.stringify(res.data)}`);
                    err.res = res;
                    fn(err);
                });
            }],

            // login
            auth: ['nonce', 'pkcs7', function login(fn, r) {
                // define login data
                const data = { pkcs7: r.pkcs7 };
                if (typeof r.options.role === 'string') {
                    data.role = r.options.role;
                }
                if (typeof r.nonce === 'string') {
                    data.nonce = r.nonce;
                }

                vault.post(`/auth/aws-ec2/login`, data)
                .then(function(res) {
                    const auth = res.data.auth;
                    fn(null, auth);
                })
                .catch(function(res) {
                    const err = new Error(`AWS-EC2 Login Failed: POST to ${res.config.url} failed with status ${res.status} and body ${JSON.stringify(res.data)}`);
                    err.res = res;
                    fn(err);
                });
            }]
        }, function(err, r) {
            cb(err, r.auth);
        });
    }
};
