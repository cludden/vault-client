'use strict';

const async = require('async');
const expect = require('chai').expect;
const ms = require('ms');
const sinon = require('sinon');
const userpass = require('../../../lib/auth/backends/userpass');
const _ = require('lodash');

describe(`vault.login()`, function() {


    context('(failures)', function() {
        it('should fail if an invalid backend is specified', function(done) {
            vault.login({
                backend: 'random',
                options: {},
                renew_interval: '15m'
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                done(e);
            });
        });

        it('should fail if no backend options are provided', function(done) {
            vault.login({
                backend: 'userpass',
                renew_interval: '15m'
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                done(e);
            });
        });

        it('should fail if the backend login method returns an error with 401 status', function(done) {
            const clock = sinon.useFakeTimers();
            sinon.spy(vault, 'login');
            sinon.stub(userpass, 'login').yieldsAsync({status: 401});
            vault.login({
                backend: 'userpass',
                options: {},
                renew_interval: '15m'
            }, function(err) {
                clock.tick(ms('10m'));
                const e = _.attempt(function() {
                    expect(err).to.exist;
                    expect(vault.login).to.have.callCount(1);
                });
                clock.restore();
                vault.login.restore();
                userpass.login.restore();
                done(e);
            });
        });

        it('should fail if the backend login method returns an error with 499 status', function(done) {
            const clock = sinon.useFakeTimers();
            sinon.spy(vault, 'login');
            sinon.stub(userpass, 'login').yieldsAsync({status: 499});
            vault.login({
                backend: 'userpass',
                options: {},
                renew_interval: '15m'
            }, function(err) {
                clock.tick(ms('10m'));
                const e = _.attempt(function() {
                    expect(err).to.exist;
                    expect(vault.login).to.have.callCount(1);
                });
                clock.restore();
                vault.login.restore();
                userpass.login.restore();
                done(e);
            });
        });

        it('should fail if the backend login method returns an error with no status', function(done) {
            const clock = sinon.useFakeTimers();
            sinon.spy(vault, 'login');
            sinon.stub(userpass, 'login').yieldsAsync(new Error('something unexpected'));
            vault.login({
                backend: 'userpass',
                options: {},
                renew_interval: '15m'
            }, function(err) {
                clock.tick(ms('10m'));
                const e = _.attempt(function() {
                    expect(err).to.exist;
                    expect(vault.login).to.have.callCount(1);
                });
                clock.restore();
                vault.login.restore();
                userpass.login.restore();
                done(e);
            });
        });

        it('should retry failed attempts if error status is not 401 or 499', function(done) {
            const timeout = global.setTimeout;
            const clock = sinon.useFakeTimers();
            sinon.spy(vault, 'login');
            sinon.stub(userpass, 'login').yieldsAsync({ status: 503 });
            vault.login({
                backend: 'userpass',
                options: {},
                renew_interval: '15m',
                retry: {
                    retries: 2,
                    factor: 1,
                    minTimeout: ms('1m'),
                    maxTimeout: ms('1m'),
                    randomize: false
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                    expect(vault.login).to.have.callCount(1);
                    expect(userpass.login).to.have.callCount(3);
                });
                clock.restore();
                vault.login.restore();
                userpass.login.restore();
                done(e);
            });
            let count = 0;
            function tick() {
                count++;
                if (count <= 3) {
                    timeout.call(global, function() {
                        clock.tick(ms('2m'));
                        tick();
                    }, 10);
                }
            }
            tick();
        });

        it('should fail if the `auth` data returned is missing a `client_token` or `lease_duration` attribute');
    });

    context('(successes)', function() {
        it('should ');
        it('should store the client_token at path `_auth.token`');
        it('should renew the login periodically based on the `renew_interval` option');
    });
});
