'use strict';

const async = require('async');
const chai = require('chai');
const sinonchai = require('sinon-chai');
const Vault = require('../../index');
const _ = require('lodash');

chai.use(sinonchai);
const expect = chai.expect;

describe(`constructor tests`, function() {

    after(function initializeVault(done) {
        const vault = _.attempt(function() {
            return new Vault({
                url: 'http://vault:8200/v1'
            });
        });
        if (_.isError(vault)) {
            return done(vault);
        }
        global.vault = vault;

        vault.on('error', function(err) {
            console.error(err);
        });

        vault.client.interceptors.request.use(function(config) {
            console.log(`VAULT:: ${config.method.toUpperCase()} ${config.url}`);
            return config;
        });

        async.auto({
            ready: function waitUntilVaultResponds(fn) {
                let ready = false;
                async.doUntil(function(done) {
                    vault.get(`/sys/health?sealedcode=200`, {
                        timeout: 1000,
                        validateStatus: function(status) {
                            return status === 200 || status === 500;
                        }
                    }, function(err, body) {
                        if (err) {
                            console.error(err);
                            done(err);
                        }
                        ready = true;
                        done(null, body);
                    });
                }, function() {
                    return ready;
                }, fn);
            },

            init: ['ready', function initializeVault(fn) {
                console.log('calling init');
                vault.put('/sys/init', {
                    secret_shares: 1,
                    secret_threshold: 1
                }, function(err, res) {
                    if (err) {
                        console.error('error initializing vault');
                    }
                    global.root_token = res.root_token;
                    fn(err, res);
                });
            }],

            unseal: ['init', function unsealVault(fn, r) {
                console.log('unseal');
                const key = r.init.keys[0];
                vault.put('/sys/unseal', { key }, fn);
            }],

            backends: ['unseal', function mountBackends(fn, r) {
                const headers = {
                    'x-vault-token': r.init.root_token
                };
                async.auto({
                    userpass: function(next) {
                        vault.post('/sys/auth/userpass', {
                            type: 'userpass'
                        }, { headers }, next);
                    }
                }, fn);
            }]
        }, done);
    });

    it('should throw if invalid options passed to client', function() {
        const tests = [{
            desc: `missing 'url'`,
            options: {}
        }];
        tests.forEach(function(test) {
            const err = _.attempt(function() {
                return new Vault(test.options);
            });

            expect(err).to.be.an('error');
        });
    });

    it('should create a new vault client', function() {
        const tests = [{
            desc: 'url only',
            options: {
                url: 'http://vault'
            }
        }];
        tests.forEach(function(test) {
            const vault = _.attempt(function() {
                return new Vault(test.options);
            });
            expect(vault).to.not.be.an('error');
        });
    });
});
