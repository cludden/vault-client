'use strict';

const async = require('async');
const expect = require('chai').expect;
const MockAdapter = require('axios-mock-adapter');
const ms = require('ms');
const sinon = require('sinon');
const utils = require('../utils');
const _ = require('lodash');

describe(`#watch()`, function() {
    context(`(expected failures)`, function() {
        it(`should fail with invalid secrets`, function(done) {
            const invalid = [
                { address: 'foo' }, // missing path
                { path: '/secret/foo' }, // missing address
                { address: '.', path: 'not a uri' } // invalid path
            ];
            async.eachSeries(invalid, function(secrets, next) {
                vault.watch(secrets, function(err) {
                    const e = _.attempt(function() {
                        expect(err).to.exist;
                    });
                    next(e);
                });
            }, done);
        });

        it(`should fail if one or more secret requests fail all attempts`, function(done) {
            const mock = new MockAdapter(vault.client);
            mock.onAny(/.+/).reply(503);
            vault.watch({path: '/secret/foo', address: 'foo'}, {
                retry: {
                    retries: 2,
                    minTimeout: 10,
                    maxTimeout: 10,
                    factor: 1
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                mock.restore();
                done(e);
            });
        });
    });

    context(`(expected successes)`, function() {
        it(`should store secrets in cache and set up renewals`, function(done) {
            const SECRETS = {
                'foo':  {
                    lease_duration: ms('24h') / 1000,
                    data: {
                        foo: 'bar'
                    }
                },
                'bar': {
                    lease_duration: ms('1h') / 1000,
                    data: {
                        bar: 'baz'
                    }
                }
            };

            const mock = new MockAdapter(vault.client);
            const counter = {
                foo: 0,
                bar: 0
            };
            mock.onAny(/.+/).reply(function(config) {
                const secretName = _.find(Object.keys(SECRETS), function(name) {
                    const re = new RegExp(name);
                    return re.test(config.url);
                });
                if (secretName) {
                    counter[secretName]++;
                    return [200, SECRETS[secretName]];
                } else {
                    return [404];
                }
            });

            const timemachine = utils.timemachine();
            async.series([
                function(fn) {
                    vault.watch([{
                        address: '.',
                        path: '/secret/foo'
                    }, {
                        address: 'bar',
                        path: '/secret/bar'
                    }], function(err, secrets) {
                        const e = _.attempt(function() {
                            expect(err).to.not.exist;
                            expect(secrets).to.be.an('object')
                            .that.contains.all.keys('foo', 'bar');
                            expect(secrets.foo).to.equal('bar');
                            expect(secrets.bar).to.be.an('object')
                            .with.property('bar', 'baz');
                        });
                        fn(e);
                    });
                },

                function(fn) {
                    async.eachSeries(_.range(24), function(i, next) {
                        timemachine.tick('61m', next);
                    }, function(err) {
                        if (err) {
                            return fn(err);
                        }
                        const e = _.attempt(function() {
                            expect(counter).to.have.property('foo', 2);
                            expect(counter).to.have.property('bar', 25);
                        });
                        fn(e);
                    });
                }
            ], function(err) {
                timemachine.restore();
                mock.restore();
                done(err);
            });
        });
    });
});
