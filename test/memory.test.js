
var common          = require('./common.rate');
    rate            = require('../lib/rate');

describe('Memory-based rate handling', function () {
    var handler = new rate.Memory.MemoryRateHandler();

    it('baseline: server can be tested', function (done) {
        common['baseline: server can be tested'](done);
    });

    it('server records rate', function (done) {
        common['server records rate'](handler, done);
    });

    it('Reset after interval', function (done) {
        common['Reset after interval'](handler, done);
    });

    handler.checkttl = function(key, cb) {
        var currentTime = (new Date()).getTime();
        return cb(null,handler.rates[key].ttl - currentTime);
    };

    handler.clockResolution = 0; // Memory TTLs are accurate.

    it('Routes can be rate limited, reallowed, and have proper headers', function (done) {
        common['Routes can be rate limited, reallowed, and have proper headers'](handler, done);
    });
});
