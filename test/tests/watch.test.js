'use strict';

const async = require('async');
const expect = require('chai').expect;
const MockAdapter = require('axios-mock-adapter');
const sinon = require('sinon');
const utils = require('../utils');
const _ = require('lodash');

describe(`#watch()`, function() {
    context(`(expected failures)`, function() {
        it(`should fail with invalid secrets`, function(done) {
            const invalid = [
                'not a uri',
                ['not a uri'],
                { id: 'foo' },
                { path: 'not a uri' }
            ];
            async.eachSeries(invalid, function(secrets, next) {
                sinon.spy(vault, 'emit');
                vault.watch(secrets, function(err) {
                    const e = _.attempt(function() {
                        expect(err).to.exist;
                    });
                    vault.emit.restore();
                    next(e);
                });
            }, done);
        });

        it(`should fail if one or more secret requests fail all attempts`, function(done) {
            sinon.spy(vault, '_watch').yieldsAsync(new Error('something unexpected'));
            vault.watch('/secret/foo', function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                    expect(vault._watch).to.have.been.called;
                });
                vault._watch.restore();
                done(e);
            });
        });
    });

    context(`(expected successes)`, function() {
        it(`should store secrets in cache and set up renewals`, function(done) {
            const SECRETS = {
                'foo':  {
                    lease_duration: 1000 * 60 * 60 * 24,
                    data: {
                        foo: 'bar'
                    }
                },
                'bar': {
                    lease_duration: 1000 * 60 * 60,
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
                        id: 'foo',
                        path: '/secret/foo'
                    }, {
                        id: 'bar',
                        path: '/secret/bar'
                    }], function(err, data) {
                        const e = _.attempt(function() {
                            expect(err).to.not.exist;
                            expect(data).to.be.an('object')
                            .that.contains.all.keys('foo', 'bar');
                            expect(data.foo).to.be.an('object')
                            .with.property('foo', 'bar');
                            expect(data.bar).to.be.an('object')
                            .with.property('bar', 'baz');
                        });
                        fn(e);
                    });
                },

                function(fn) {
                    timemachine.tick('24.01h', function() {
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
