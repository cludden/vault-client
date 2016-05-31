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
                joi.validate(options, schema, function(err) {
                    if (err) {
                        return cb(err);
                    }
                    fn();
                });
            },

            function authenticate(fn) {
                vault.post(`/auth/userpass/login/${options.username}`, {
                    password: options.password
                }, function(err, data) {
                    if (err) {
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
