'use strict';

const expect = require('chai').expect;

describe('#secret()', function() {
    it('should return a cloned version of the whole store if no path is provided', function() {
        const result = vault.secret();
        expect(result).to.eql({});
    });

    it('should return nothing if the path does not exist', function() {
        const result = vault.secret('test');
        expect(result).to.be.undefined;
    });
});
