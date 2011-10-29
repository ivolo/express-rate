
var sys             = require('sys'),
    base            = require('./base');

//
// DEFINE THE MEMORY RATE HANDLER
//

var RedisRateHandler = exports.RedisRateHandler = function (options) {
    this.options = options;
    this.client = this.options.client;
    this.initialized = !(typeof this.options.client == 'function');
};

// inherit from the base rate handler
sys.inherits(RedisRateHandler, base.BaseRateHandler);

RedisRateHandler.prototype.initialize = function () {
    if (typeof this.options.client == 'function') {
        this.client = this.options.client();
    }

    this.initialized = true;
};

RedisRateHandler.prototype._increment_key = function (key, increment, rate_options, next, callback) {

    if (!this.initialized)
        this.initialize();

    var currentTime = (new Date()).getTime(),
        ttl = currentTime + (rate_options.interval * 1000),
        rate = 1,
        self = this;

    this.client.multi()
        .incrby(key, increment)
        .ttl(key)
        .exec(function (err, replies) {
            
        if (err) next(err);

        currentTime = (new Date()).getTime();
        
        rate = replies[0];

        // if the key was just created now, we need to set an expiraton
        if(rate === increment) {
            ttl = currentTime + (rate_options.interval * 1000);
            self.client.expire(key, rate_options.interval);
        } else {
            ttl = currentTime + (replies[1] * 1000);
        }

        if (callback) callback(rate, ttl);
    });
};

RedisRateHandler.prototype._reset_key = function (key, increment, next, callback) {

    if (!this.initialized)
        this.initialize();

    this.client.del(key, function (err, reply) {
        if (err) next(err);
        if (callback) callback();
    });
};


RedisRateHandler.prototype.getRate = function (routeKey, remoteKey, next, callback) {
    
    if (!this.initialized)
        this.initialize();

    var fullKey = routeKey;
    if (remoteKey) {
        fullKey += ':' + remoteKey;
    }

    this.client.get(fullKey, function (err, rate) {
        if (err) next(err);

        if (rate)
            callback(rate);
        else
            callback(0);
    });   
};
