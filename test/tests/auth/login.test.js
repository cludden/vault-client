'use strict';

const async = require('async');
const expect = require('chai').expect;
const faker = require('faker');
const ms = require('ms');
const sinon = require('sinon');
const userpass = require('../../../lib/auth/backends/userpass');
const _ = require('lodash');

function tick(timeout, clock, time, cb) {
    timeout.call(global, function() {
        clock.tick(ms(time));
        timeout.call(global, cb, 0);
    }, 100);
}

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

        it('should fail if the `auth` data returned is missing a `client_token` or `lease_duration` attribute', function(done) {
            const clock = sinon.useFakeTimers();
            sinon.spy(vault, 'login');
            sinon.stub(userpass, 'login').yieldsAsync(null, {});
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
                    expect(userpass.login).to.have.callCount(1);
                });
                clock.restore();
                vault.login.restore();
                userpass.login.restore();
                done(e);
            });
            clock.tick(ms('10m'));
        });
    });

    context('(successes)', function() {

        it('should periodically update the client_token based on the renewal_interval', function(done) {
            const timeout = global.setTimeout;
            const clock = sinon.useFakeTimers();
            sinon.spy(vault, 'login');
            const stub = sinon.stub(userpass, 'login');
            const args = [];
            _.range(3).forEach(function(i) {
                const auth = {
                    client_token: faker.random.uuid(),
                    lease_duration: ms('30m') / 1000
                };
                args.push(auth);
                stub.onCall(i).yieldsAsync(null, auth);
            });
            vault.login({
                backend: 'userpass',
                options: {},
                retry: {
                    forever: true,
                    factor: 1,
                    minTimeout: ms('1m'),
                    maxTimeout: ms('1m')
                }
            });
            async.eachSeries(_.range(2), function(i, next) {
                tick(timeout, clock, '30.1m', next);
            }, function() {
                const err = _.attempt(function() {
                    expect(vault.status).to.equal('authenticated');
                    expect(_.get(vault, '_auth.token')).to.be.a('string');
                    expect(vault.login).to.have.callCount(3);
                });
                clock.restore();
                vault.login.restore();
                userpass.login.restore();
                done(err);
            });
        });

        it('should continue to login even if there are network disruptions', function(done) {
            const timeout = global.setTimeout;
            const clock = sinon.useFakeTimers();
            sinon.spy(vault, 'login');
            const stub = sinon.stub(userpass, 'login');

            // first login, unsuccessful 3 times
            const timeoutError = new Error('timeout of');
            timeoutError.code = 'ECONNABORTED';
            const args = [];
            _.range(3).forEach(function(i) {
                args.push([timeoutError]);
                stub.onCall(i).yieldsAsync(timeoutError);
            });
            // next 50 renewals successful
            _.range(3,53).forEach(function(i) {
                const auth = {
                    client_token: faker.random.uuid(),
                    lease_duration: ms('30m') / 1000
                };
                args.push([null, auth]);
                stub.onCall(i).yieldsAsync(null, auth);
            });
            _.range(53, 55).forEach(function(i) {
                args.push([timeoutError]);
                stub.onCall(i).yieldsAsync(timeoutError);
            });
            const lastAuth = {
                client_token: faker.random.uuid(),
                lease_duration: ms('30m') / 1000
            };
            args.push([null, lastAuth]);
            stub.onCall(55).yieldsAsync(null, lastAuth);
            vault.login({
                backend: 'userpass',
                options: {},
                renew_interval: '15m',
                retry: {
                    forever: true,
                    factor: 1,
                    minTimeout: ms('45s'),
                    maxTimeout: ms('45s')
                }
            });
            async.waterfall([
                // handle initial login (fail, fail, fail, success)
                function(fn) {
                    timeout(function() {
                        async.eachSeries(_.range(4), function(i, next) {
                            tick(timeout, clock, '1m', next);
                        }, function() {
                            const err = _.attempt(function() {
                                expect(userpass.login).to.have.callCount(4);
                                expect(_.get(vault, '_auth.token')).to.equal(args[3][1].client_token);
                            });
                            fn(err);
                        });
                    }, 0);
                },

                // handle next 50 successfull renewals
                function(fn) {
                    async.eachSeries(_.range(49), function(i, next) {
                        const callcount = userpass.login.callCount;
                        tick(timeout, clock, '30.1m', function() {
                            const err = _.attempt(function() {
                                expect(userpass.login.callCount).equal(callcount + 1);
                            });
                            next(err);
                        });
                    }, function(err) {
                        tick(timeout, clock, '10s', function() {
                            const e = _.attempt(function() {
                                expect(err).to.not.exist;
                                expect(userpass.login).to.have.callCount(53);
                                expect(_.get(vault, '_auth.token')).to.equal(args[52][1].client_token);
                            });
                            fn(e);
                        });
                    });
                },

                function(fn) {
                    tick(timeout, clock, '30.1m', function() {
                        const err = _.attempt(function() {
                            expect(userpass.login).to.have.callCount(54);
                            expect(vault.status).to.equal('unauthenticated');
                        });
                        fn(err);
                    });
                },

                // handle next 2 renewals
                function(fn) {
                    async.eachSeries(_.range(2), function(i, next) {
                        tick(timeout, clock, '1m', next);
                    }, function() {
                        tick(timeout, clock, '10s', function() {
                            const err = _.attempt(function() {
                                expect(userpass.login).to.have.callCount(56);
                                expect(_.get(vault, '_auth.token')).to.equal(_.last(args)[1].client_token);
                                expect(vault.status).to.equal('authenticated');
                            });
                            fn(err);
                        });
                    });
                }
            ], function(err) {
                clock.restore();
                userpass.login.restore();
                vault.login.restore();
                vault.logout();
                done(err);
            });
        });
    });
});
