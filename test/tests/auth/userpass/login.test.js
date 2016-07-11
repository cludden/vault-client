'use strict';

const async = require('async');
const expect = require('chai').expect;
const faker = require('faker');
const MockAdapter = require('axios-mock-adapter');
const sinon = require('sinon');
const userpass = require('../../../../lib/auth/backends/userpass');
const _ = require('lodash');

describe(`[backend:userpass] login`, function() {
    const credentials = {
        username: 'test',
        password: faker.internet.password()
    };

    before(function(done) {
        async.auto({
            user: function createUser(fn) {
                vault.post(`/auth/userpass/users/${credentials.username}`, {
                    username: credentials.username,
                    password: credentials.password,
                    policies: 'root',
                    ttl: credentials.session_ttl,
                    max_ttl: credentials.session_ttl
                }, {
                    headers: { 'x-vault-token': root_token }
                }, fn);
            }
        }, done);
    });

    after(function(done) {
        vault.logout();
        vault.delete(`/auth/userpass/users/${credentials.username}`, {
            headers: {'x-vault-token': root_token }
        }, done);
    });

    context('(failures)', function() {
        it('should fail if the backend options are missing a `username` attribute', function(done) {
            vault.login({
                backend: 'userpass',
                options: {
                    password: credentials.password
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                done(e);
            });
        });

        it('should fail if the backend options are missing a `password` attribute', function(done) {
            vault.login({
                backend: 'userpass',
                options: {
                    username: credentials.username
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                done(e);
            });
        });

        it('should fail (401) if the user does not exist', function(done) {
            vault.login({
                backend: 'userpass',
                options: {
                    username: 'bob',
                    password: credentials.password
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                if (e) {
                    console.log(err);
                }
                done(e);
            });
        });

        it('should fail (401) if the password is incorrect', function(done) {
            vault.login({
                backend: 'userpass',
                options: {
                    username: 'test',
                    password: faker.internet.password()
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                done(e);
            });
        });

        it('should fail there is an unexpected error', function(done) {
            const mock = new MockAdapter(vault.client);
            mock.onPost(/\/auth\/userpass\/login\//).reply(503, {errors: ['error']});
            sinon.spy(userpass, 'login');
            vault.login({
                backend: 'userpass',
                options: credentials,
                retry: {
                    retries: 1,
                    factor: 1,
                    minTimeout: 10
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                    expect(userpass.login).to.have.callCount(2);
                });
                userpass.login.restore();
                mock.restore();
                done(e);
            });
        });
    });

    context('(successes)', function() {
        it('should return a valid auth object', function(done) {
            vault.login({
                backend: 'userpass',
                options: credentials,
                retry: {
                    retries: 1,
                    factor: 1,
                    minTimeout: 10
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.not.exist;
                    expect(vault.status).to.equal('authenticated');
                    expect(_.get(vault, '_auth.token')).to.be.a('string');
                });
                done(e);
            });
        });
    });
});
