'use strict';

const async = require('async');
const expect = require('chai').expect;
const faker = require('faker');
const _ = require('lodash');

describe('[basic tests]', function() {
    it('should apply the current token to every request', function(done) {
        const credentials = {
            username: 'test',
            password: faker.internet.password()
        };

        async.auto({
            // create a test user
            createUser: function(fn) {
                vault.post(`/auth/userpass/users/${credentials.username}`, {
                    username: credentials.username,
                    password: credentials.password,
                    policies: 'root',
                    ttl: credentials.session_ttl,
                    max_ttl: credentials.session_ttl
                }, {
                    headers: { 'x-vault-token': root_token }
                }, fn);
            },

            // create a sample secret
            createSecret: function(fn) {
                vault.post('/secret/foo', {
                    bar: 'baz'
                },{
                    headers: { 'x-vault-token': root_token }
                }, fn);
            },

            // login using test user credentials
            login: ['createUser', function(fn) {
                vault.login({
                    backend: 'userpass',
                    options: credentials
                }, fn);
            }],

            // fetch the secret
            test: ['login', 'createSecret', function(fn) {
                vault.get('/secret/foo', function(err, data) {
                    const e = _.attempt(function() {
                        expect(err).to.not.exist;
                        expect(data).to.be.an('object').with.property('data')
                        .that.is.an('object').with.property('bar', 'baz');
                    });
                    fn(null, e);
                });
            }],

            // logout
            logout: ['test', function(fn) {
                vault.logout();
                async.setImmediate(fn);
            }],

            // destroy the test user
            cleanupUser: ['logout', function(fn) {
                vault.delete(`/auth/userpass/users/${credentials.username}`, {
                    headers: {'x-vault-token': root_token }
                }, fn);
            }],

            // destroy the secret
            cleanupSecret: ['logout', function(fn) {
                vault.delete(`/secret/foo`, {
                    headers: {'x-vault-token': root_token }
                }, fn);
            }]
        }, function(err, r) {
            if (err) {
                return done(err);
            }
            done(r.test);
        });
    });
});
