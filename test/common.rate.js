var request         = require('supertest'),
    express         = require('express'),
    assert          = require('chai').assert,
    async           = require('async'),

    rate            = require('../lib/rate'),
    memory          = require('../lib/memory');

var getRouteKey =  function(req) {return module.exports.routeKey};

var rand = function(n) {
    return Math.ceil(Math.random() * n);
}

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
}


module.exports = {
    
    routeKey: 'whoola', // get:/^\\/\\/?$/i',
    
    'baseline: server can be tested' : function (done) {
	
        var app = express();
        
        var responseBody = 'works';
        
        app.get('/', function (req, res) {
            res.send(responseBody);
        });
        
        request(app)
            .get('/')
            .expect(responseBody, done)
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
        handler.reset(module.exports.routeKey, null, null, function () {
            var app = express();
            var responseBody = 'works';
            var errorJson = 'limited';
            
            var limit = 10;
            var middleware = rate.middleware({handler: handler, interval: 5, limit: limit, getRouteKey: getRouteKey,
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
                    .expect('X-RateLimit-Limit', limit, 'Limit does not match the header limit returned from server.')
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
                                return false;
                            }
                        } else {
                            limitedRequests += 1;
                            if (limitedRequests > 5) {
                             	
                        	var currentTime = (new Date()).getTime();
                        	var sleepForMs = parseInt(res.headers['X-RateLimit-Reset'.toLowerCase()]) - currentTime;
                                // TODO: bug, have to add an extra second for differences between redis time and local time
                                // need to find correct way to do this
                        	sleepForMs += 1000;
                        	setTimeout(function () {
                        	    lastCheck = true;
                        	    makeRequest({body: responseBody});
                        	}, sleepForMs);
                            } else {
                            	makeRequest({body: errorJson});
                            }
                        }
                    }).end(function(){});
            }
            makeRequest({body: responseBody});
        });
    }
}

    
