var rate            = require('../lib/rate'),
	redis			= require('redis'),
	client			= redis.createClient();

var app = require('express').createServer();

// create the rate redis handler
var redisHandler = new rate.Redis.RedisRateHandler({client: client});



// 
// Monitor rate of a route
//

// options: handler is the mechanism where rate information is kept
// interval is the interval on which we are listening for the rate. Here we're counting requests per 1 second.
// If we switch interval to 10, then we are counting how many requests this route is handling per 10 seconds.
var simpleMiddleware = rate.middleware({handler: redisHandler, interval: 1});

app.get('/', simpleMiddleware, function(req, res, next){
	res.send('I am being rate monitored at requests per 1 second.')
});

//
// Monitor the rate of this route, and report the RPS of **everyone** hitting this route
//
var monitorMiddleware1 = rate.middleware({handler: redisHandler, interval: 1});

app.get('/route-rate', monitorMiddleware1, function(req, res, next){
	var rateKey = req.route.method + ':' + req.route.regexp;
	redisHandler.getRate(rateKey, null, next, function (rate) {
		res.send('This route is being requested at ' + rate + ' requests per 1 second.');
	});
});

//
// Monitor the rate of this route, and report the RPS of **only you** hitting this route
//
var monitorMiddleware2 = rate.middleware({handler: redisHandler, interval: 1});

app.get('/me-rate', monitorMiddleware2, function(req, res, next){
	var rateKey = req.route.method + ':' + req.route.regexp;
	var remoteKey = req.connection.remoteAddress;
	redisHandler.getRate(rateKey, remoteKey, next, function (rate) {
		res.send(remoteKey + ' is requesting this route at ' + rate + ' requests per 1 second.');
	});
});

//
// Monitor and rate-limit this route
//

// this middleware will only allow 2 requests for every 4 seconds from a specific user
var limiterMiddleware = rate.middleware({handler: redisHandler, interval: 4, limit: 2});

app.get('/limited', limiterMiddleware, function(req, res){
  res.send('You can only request me twice every 4 seconds!');
});


// 
// Key requesters by their API key instead of IP
//

var apiKeyMiddleware = rate.middleware(
	{handler: redisHandler, 
	 limit: 10,
	 interval: 2, 
	 getRemoteKey: function (req) {
	 	return req.params.api_key;
	 }
});

app.get('/api/:api_key/operation', apiKeyMiddleware, function(req, res){
	res.send('API key ' + req.params.api_key + ' only has ' + res.getHeader('x-ratelimit-remaining') + ' remaining requests.');
});

// 
// Customize the headers sent back during rate limiting and the message returned
//

var headersMiddleware = rate.middleware(
	{handler: redisHandler, 
	 limit: 5,
	 interval: 5, 
	 setHeadersHandler: function (req, res, rate, limit, resetTime) {

            var remaining = limit - rate;

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
});

app.get('/headers', headersMiddleware, function(req, res){
	var text = 'X-RateLimit-Limit :' + res.getHeader('X-RateLimit-Limit') + '              ' + 
		'X-RateLimit-Remaining :' + res.getHeader('X-RateLimit-Remaining') + '              ' + 
		'X-RateLimit-Reset :' + res.getHeader('X-RateLimit-Reset');
	res.send(text);
});

app.listen(3000);