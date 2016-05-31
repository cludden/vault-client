'use strict';

const async = require('async');
const faker = require('faker');
const ms = require('ms');

describe(`[login] userpass`, function() {
    const credentials = {
        username: 'test',
        password: faker.internet.password(),
        session_ttl: ms('30m') / 1000
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

    context('(failures)', function() {
        it('should fail with invalid options');
    });
});
