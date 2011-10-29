
exports.Base             = require('./base');
exports.Memory           = require('./memory');
exports.Redis            = require('./redis');

// 
// DEFAULTS FOR OPTIONS
// extensibility point
//

exports.defaults = function () {

    return {

        handler: new exports.Memory.MemoryRateHandler(),

        getRemoteKey: function (req) {
            return req.connection.remoteAddress;
        },

        getRouteKey: function (req) {
            return req.route.method + ':' + req.route.regexp;
        },


        interval: 1,

        limit: 0,

        setHeaders: true,

        setHeadersHandler: function (req, res, rate, limit, resetTime) {

            var remaining = limit - rate;

            // remaining can be smaller than 0 because it just counts how many requests were made
            // and is incremented whether or not it is over the limit
            // we just won't allow the request to continue to the controller if its over the limit
            // we zero it here so it doesnt confuse the user

            // logic behind this is so for REDIS, we only have to make one increment request (which returns
            // the current count), with 
            // one roundtrip to the server. Otherwise, we would have to first check what the value is and
            // then increment if smaller (which is two roundtrips to the server)
            // if someone knows how to do conditionals in REDIS multi transactions, let me know!
            if (remaining < 0) {
                remaining = 0;
            }


            // follows Twitter's rate limiting scheme and header notation
            // https://dev.twitter.com/docs/rate-limiting/faq#info
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', resetTime);
        },

        onLimitReached: function (req, res, rate, limit, resetTime, next) {
            
            // HTTP code 420 from http://mehack.com/inventing-a-http-response-code-aka-seriously
            res.json({error: 'Rate limit exceeded. Check headers for limit information.'}, {status: 420});
        }

    };
};

//
// MIDDLEWARE
//

exports.middleware = function recordRate(options) {

    var defaults = exports.defaults();

    options = options || {};

    for (var prop in defaults) {
        if (options[prop] == null) options[prop] = defaults[prop];
    }

    return function recordRate(req, res, next) {

        var routeKey = options.getRouteKey(req),
            remoteKey = options.getRemoteKey(req),
            incrementCallback = null;

        // check if there is a limit set on this route, and reject request with headers if so
        if (options.limit) {

            // use the callback to get the rate
            incrementCallback = function (rate, resetTime) {

                if (options.setHeaders) {
                    options.setHeadersHandler(req, res, rate, options.limit, resetTime);
                }

                if (rate > options.limit) {

                    // we are officially over the limit
                    options.onLimitReached(req, res, rate, options.limit, resetTime, next);

                } else {

                    next();
                    
                }
            };
        }

        options.handler.increment(routeKey, remoteKey, options, next, incrementCallback);

        // if we don't have rate limiting turned on, then we don't care when incrementing the rate finishes
        // let's keep going with the request
        if (!incrementCallback)
            next();
    }
};
