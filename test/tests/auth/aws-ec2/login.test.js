'use strict';

const async = require('async');
const axios = require('axios');
const backend = require('../../../../lib/auth/backends/aws-ec2');
const expect = require('chai').expect;
const MockAdapter = require('axios-mock-adapter');
const sinon = require('sinon');
const _ = require('lodash');

describe(`aws-ec2#login()`, function() {
    context(`(expected failures)`, function() {
        it(`should fail if an invalid "nonce" option is provided`, function(done) {
            backend.login(vault, {
                nonce: /somethingInvalid/g
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                done(e);
            });
        });

        it(`should fail if an invalid "role" option is provided`, function(done) {
            backend.login(vault, {
                role: /somethingInvalid/g
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                done(e);
            });
        });

        it(`should fail if the "nonce" function throws`, function(done) {
            const mock = new MockAdapter(axios);
            mock.onGet(/\/pkcs7/).reply(200, 'abcdef');
            backend.login(vault, {
                nonce: sinon.stub().throws(new Error('something unexpected'))
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                mock.restore();
                done(e);
            });
        });

        it(`should fail if the "nonce" function errors`, function(done) {
            const mock = new MockAdapter(axios);
            mock.onGet(/\/pkcs7/).reply(200, 'abcdef');
            backend.login(vault, {
                nonce: function(cb) {
                    return async.setImmediate(function() {
                        cb(new Error('something unexpected'));
                    });
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                mock.restore();
                done(e);
            });
        });

        it(`should fail if there is an error retrieving the pkcs7 signature from AWS`, function(done) {
            const mock = new MockAdapter(axios);
            mock.onGet(/\/pkcs7/).reply(504);
            backend.login(vault, {
                nonce: 'my-nonce'
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                mock.restore();
                done(e);
            });
        });

        it(`should fail if there is an error on login`, function(done) {
            const axiosMock = new MockAdapter(axios);
            const vaultMock = new MockAdapter(vault.client);
            axiosMock.onGet(/\/pkcs7/).reply(200, 'abcdef');
            vaultMock.onPost(/\/login/).reply(400, {errors: ['invalid signature']});
            backend.login(vault, {
                nonce: function(cb) {
                    return async.setImmediate(function() {
                        cb(new Error('something unexpected'));
                    });
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.exist;
                });
                axiosMock.restore();
                vaultMock.restore();
                done(e);
            });
        });
    });

    context(`(expected successes)`, function() {
        it(`should return the "auth" attribute from the response body`, function(done) {
            const axiosMock = new MockAdapter(axios);
            const vaultMock = new MockAdapter(vault.client);
            let loginConfig;
            axiosMock.onGet(/\/pkcs7/).reply(200, 'abcdef');
            vaultMock.onPost(/\/login/).reply(function(c) {
                loginConfig = c;
                return [200, {
                    'auth': {
                        'renewable': true,
                        'lease_duration': 1800000,
                        'metadata': {
                            'role_tag_max_ttl': '0',
                            'instance_id': 'i-de0f1344',
                            'ami_id': 'ami-fce3c696',
                            'role': 'dev-prod'
                        },
                        'policies': [
                            'default',
                            'dev',
                            'prod'
                        ],
                        'accessor': '20b89871-e6f2-1160-fb29-31c2f6d4645e',
                        'client_token': 'c9368254-3f21-aded-8a6f-7c818e81b17a'
                    },
                    'warnings': null,
                    'data': null,
                    'lease_duration': 0,
                    'renewable': false,
                    'lease_id': ''
                }];
            });
            vault.login({
                backend: 'aws-ec2',
                options: {
                    nonce: 'my-nonce'
                }
            }, function(err) {
                const e = _.attempt(function() {
                    expect(err).to.not.exist;
                    expect(loginConfig).to.have.property('data');
                    const loginData = JSON.parse(loginConfig.data);
                    expect(loginData).to.have.property('pkcs7', 'abcdef');
                    expect(loginData).to.have.property('nonce', 'my-nonce');
                });
                axiosMock.restore();
                vaultMock.restore();
                done(e);
            });
        });
    });
});
