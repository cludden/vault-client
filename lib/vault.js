'use strict';

const auth = require('./auth');
const axios = require('axios');
const EventEmitter = require('events').EventEmitter;
const joi = require('joi');
const util = require('util');
const _ = require('lodash');

function Vault(options) {
    const self = this;

    EventEmitter.call(this);

    joi.assert(options, joi.object({
        url: joi.string().uri({ relative: true }).required()
    }).unknown(true).required());
    self.options = options;

    self.client = axios.create({
        baseURL: options.url
    });
    self.client.interceptors.request.use(function(config) {
        _.merge(config, {
            headers: {
                'X-Vault-Token': self._token
            }
        });
        return config;
    });

    self.status = 'unauthenticated';
}

util.inherits(Vault, EventEmitter);

['delete', 'head', 'get', 'post', 'path', 'put'].forEach(function(method) {
    Vault.prototype[method] = function() {
        const args = [];
        const self = this;
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        let cb;
        if (_.isFunction(args[args.length - 1])) {
            cb = args.pop();
        }
        if (cb) {
            self.client[method].apply(self.client, args).then(function(res) {
                const data = _.get(res, 'data');
                const err = _.attempt(function() {
                    cb(null, data);
                });
                if (err) {
                    self.emit('error', err);
                }
            }).catch(function(res) {
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
