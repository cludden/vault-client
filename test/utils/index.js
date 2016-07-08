'use strict';

const ms = require('ms');
const sinon = require('sinon');
const _ = require('lodash');

module.exports = {
    timemachine() {
        const timeout = global.setTimeout;
        const clock = sinon.useFakeTimers();
        return {
            restore() {
                clock.restore();
            },

            tick(time, wait, cb) {
                if (_.isFunction(wait)) {
                    cb = wait;
                    wait = 0;
                }
                timeout.call(global, function() {
                    clock.tick(_.isString(time) ? ms(time) : time);
                    timeout.call(global, cb, wait);
                }, wait);
            }
        };
    }
};
