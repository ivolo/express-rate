
var common          = require('./common.rate');
    rate            = require('../lib/rate'),
    redis           = require('redis'),
    client          = redis.createClient();

/*
it('baseline: server can be tested', function (done) {
  common['baseline: server can be tested'](done);
});

it('server records rate', function (done) {
 var handler = new rate.Redis.RedisRateHandler({client: client});
 common['server records rate'](handler, done);
});


it('Reset after interval', function (done) {
 var handler = new rate.Redis.RedisRateHandler({client: client});
 common['Reset after interval'](handler, done);
});
*/

it('Routes can be rate limited, reallowed, and have proper headers', function (done) {
    this.timeout(10000);
    var handler = new rate.Redis.RedisRateHandler({client: client});
    common['Routes can be rate limited, reallowed, and have proper headers'](handler, done);
});
