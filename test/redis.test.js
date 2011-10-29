
var common          = require('./common.rate');
    rate            = require('../lib/rate'),
    redis           = require('redis'),
    client          = redis.createClient();

var onFinished = function () {
    client.end();
};

module.exports = {


    //
    // TODO: I have not figured out how tu run these tests in parallel or in serial (--serial flag) because of the
    // shared REDIS resource, if run one at a time, each of them pass for me, but not together
    // 

    /*
    'baseline: server can be tested' : function () {
        common['baseline: server can be tested']();
    },


    'server records rate': function (done) {
        var handler = new rate.Redis.RedisRateHandler({client: client});
        common['server records rate'](handler, onFinished);
    },

    'Reset after interval': function (done) {
        var handler = new rate.Redis.RedisRateHandler({client: client});
        common['Reset after interval'](handler, onFinished);
    },
    */

    'Routes can be rate limited, reallowed, and have proper headers': function (done) {
        var handler = new rate.Redis.RedisRateHandler({client: client});
        common['Routes can be rate limited, reallowed, and have proper headers'](handler, onFinished);
    }

};