'use strict';

const async = require('async');
const joi = require('joi');

module.exports = {
    /**
     * Login with username and password
     * @param  {Object} vault
     * @param  {Object} options
     * @param  {String} options.password
     * @param  {String} options.username
     * @param  {Function} cb
     */
    login(vault, options, cb) {
        async.waterfall([
            function validateOptions(fn) {
                const schema = joi.object({
                    username: joi.string().required(),
                    password: joi.string().required()
                }).unknown('true');
                joi.validate(options, schema, fn);
            },

            function authenticate(validated, fn) {
                vault.post(`/auth/userpass/login/${validated.username}`, {
                    password: validated.password
                }, function(err, data) {
                    if (err) {
                        if (err.status === 400) {
                            err.status === 401;
                        }
                        cb(err);
                    } else {
                        cb(null, data.auth);
                    }
                    fn();
                });
            }
        ]);
    }
};
