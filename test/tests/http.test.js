'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const _ = require('lodash');

describe('http', function() {
    it('should return a promise if no callback is provided', function() {
        const fullfilled = vault.get('/sys/health');
        const rejected = vault.get('/not/a/real/endpoint');
        return Promise.all([
            expect(fullfilled).to.be.fullfilled,
            expect(rejected).to.be.rejected
        ]);
    });

    it(`should capture error's in success handlers and emit them as errors`, function(done) {
        const spy = sinon.spy();
        vault.on('error', spy);
        vault.get('/sys/health', function() {
            setTimeout(function() {
                const e = _.attempt(function() {
                    expect(spy).to.have.been.called;
                });
                done(e);
            }, 0);
            throw new Error('uh oh!');
        });
    });
});
