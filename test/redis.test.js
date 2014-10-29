
var common          = require('./common.rate');
    rate            = require('../lib/rate'),
    redis           = require('redis'),
    client          = redis.createClient();

describe('Redis-based rate handling', function () {
    var handler = new rate.Redis.RedisRateHandler({client: client});

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
        return client.ttl(key, cb);
    };
        
    it('Routes can be rate limited, reallowed, and have proper headers', function (done) {
        common['Routes can be rate limited, reallowed, and have proper headers'](handler, done);
    });
});    
