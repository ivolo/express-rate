var request         = require('supertest'),
    express         = require('express'),
    assert          = require('chai').assert,
    async           = require('async'),

    rate            = require('../lib/rate'),
    memory          = require('../lib/memory');

var getRouteKey =  function(req) {
    return module.exports.routeKey
};

var rand = function(n) {
    return Math.ceil(Math.random() * n);
};

var performNRequests = function (middleware, n, callback) {
    var app = express();
    var responseBody = 'works';
    
    app.get('/', middleware,
            function (req, res) {
                res.send(responseBody);
            }
           );
    
    async.times(n, function(n, next) {
        request(app)
            .get('/')
            .expect(responseBody)
            .end(next);
    }, callback);
};

var checkerr = function(callback) {
    return function(err, res) { 
        if (err) throw err;
        if (typeof callback == 'function')
            callback();
    };
};


module.exports = {
    
    routeKey: 'get:/^\\/\\/?$/i',
    
    'baseline: server can be tested' : function (done) {
	
        var app = express();
        
        var responseBody = 'works';
        
        app.get('/', function (req, res) {
            res.send(responseBody);
        });
        
        request(app)
            .get('/')
            .expect(responseBody)
            .end(checkerr(done))
    },
    
    'server records rate' : function (handler, done) {
        
        handler.reset(module.exports.routeKey, null, null, function () {
    	    var middleware = rate.middleware({handler: handler, interval: 2, getRouteKey: getRouteKey});
            var requestsToPerform = rand(10) + 5;
    	    performNRequests(middleware, requestsToPerform, function () {
                handler.getRate(module.exports.routeKey, null, null, function (rate) {
                    assert.equal(rate, requestsToPerform, 'Rate of received from middleware does not match sent. (' +
                                 rate + ' != ' + requestsToPerform + ')');
                    done();
                });
            });
        });
    },

    'Reset after interval': function (handler, done) {

        handler.reset(module.exports.routeKey, null, null, function () {

    	    var middleware = rate.middleware({handler: handler, interval: 1, getRouteKey: getRouteKey});

            var firstHits = rand(10) + 1;
            var secondHits = rand(10) + 1;

            var iterate = function (hits, expectedRate, next) {
    	        performNRequests(middleware, hits, function () {
    		    handler.getRate(module.exports.routeKey, null, null, function (rate) {
                        assert(rate == expectedRate, 'Did not see the expected number of hits');
                        next()
                    });
                });
            };

            iterate(firstHits, firstHits, function() { // A few hits.
                iterate(secondHits, firstHits + secondHits, function() { // A few more.
                    setTimeout(function() { // Counter should have reset by now.
                        iterate(firstHits, firstHits, done);
                    }, 1000);
                });
            });
        });
    },
                      
    'Routes can be rate limited, reallowed, and have proper headers': function (handler, done) {
        handler.reset(module.exports.routeKey, '127.0.0.1', null, function () {
            var app = express();
            var responseBody = 'works';
            var errorJson = 'limited';
            
            var limit = 10;
            var middleware = rate.middleware({handler: handler, interval: 1, limit: limit, getRouteKey: getRouteKey,
            	                              onLimitReached: function (req, res, rate, limit, resetTime, next) {
    		                                  // HTTP code 420 from http://mehack.com/inventing-a-http-response-code-aka-seriously
    		                                  res.status(420).send(errorJson);
    		                              }
                                             });
            
            app.get('/', middleware,
                    function (req, res) {
                        res.send(responseBody);
                    }
                   );
            
            var limitedRequests = 0;
            var lastCheck = false;
            
            var makeRequest = function (response) {
                request(app)
                    .get('/')
                    .expect(response.body)
                    .expect(function(res) {
                        assert.isDefined(res.headers['X-RateLimit-Limit'.toLowerCase()]);
                        assert.isDefined(res.headers['X-RateLimit-Remaining'.toLowerCase()]);
                        assert.isDefined(res.headers['X-RateLimit-Reset'.toLowerCase()]);
                        
                        // check the headers
                        if (parseInt(res.headers['X-RateLimit-Remaining'.toLowerCase()]) > 0) {
                            if (!lastCheck) {
                            	makeRequest({body: responseBody});
        	            } else {
                                done();
                            }
                        } else { // We're being limited.
                            limitedRequests += 1;
                            if (limitedRequests > 5) {
                                var checkTTL = function() { // Wait until the store TTL expires.
                                    handler.checkttl(getRouteKey(), function(err,resp) {
                                        if (resp >= 0) { // Still not expired.
                        	            setTimeout(checkTTL, 50);
                                        } else {
                        	            var currentTime = (new Date()).getTime();
                        	            var expectedExpiryTime = parseInt(res.headers['X-RateLimit-Reset'.toLowerCase()]);
                                            var redisInaccuracy = 1000; // Redis clock resolution, 1 second.
                                            assert.operator(currentTime, '>', expectedExpiryTime - redisInaccuracy);
                        	            lastCheck = true;
                            	            makeRequest({body: responseBody});
                                        }
                                    });
                                };
                                checkTTL();
                            } else {
                            	makeRequest({body: errorJson});
                            }
                        }
                    }).end(checkerr());
            }
            makeRequest({body: responseBody});
        });
    }
}

    
