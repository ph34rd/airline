'use strict';

// global error handler
process.on("uncaughtException", function(err) {
	// trace error & kill worker
	console.error("Error [core]", err);
	console.error(err.stack);
	return process.exit(1);
});

var config = require('./config'),
	express = require('express'),
	bodyParser = require('body-parser'),
	ect = require('ect'),
	http = require('http'),
	path = require('path'),
	app = express(),
	FlightstatsHelper = require('./src/flightstatsHelper'),
	fh = new FlightstatsHelper(config.flightstats);

app.disable('x-powered-by');

// are we have nginx proxy?
if (config.trustProxy) {
	app.enable('trust proxy');
} else {
	app.use(express.static(path.join(__dirname, './public')));
}

app.engine('ect', ect({
	watch: true, 
	root: path.join(__dirname, './views'), 
	ext: '.ect' 
}).render);
app.set('view engine', 'ect');

app.use(bodyParser());

app.get('/', function(req, res, next) {
	res.render('index', function(err, html) {
		if (err) {
			next(err);
		} else {
			res.end(html);
		}
	});	
});	

app.post('/byRoute', function(req, res, next) {
	if ((req.xhr) && (req.accepts('json'))) {
		// we need real validation here...
		var rgxAirport =/^[-\d\w(), \\\/]+$/,
			rgxDate = /^\d{4}-\d{2}-\d{2}$/;
		if ((req.body.departure) && 
			(req.body.arrival) &&
			(req.body.date) &&
			(rgxAirport.test(req.body.departure)) &&
			(rgxAirport.test(req.body.arrival)) &&
			(rgxDate.test(req.body.date))) {
			fh.flightStatusByRoute(req.body.departure, req.body.arrival, req.body.date, function(err, data) {
				if (err) {
					// pass error
					//next(err);
					res.json({ status: "fail", message: 'No data' });
					res.end();
				} else {
					res.json({ status: "success", data: data });
					res.end();
				}
			});
		} else {
			res.json({ status: "fail", message: 'Bad parameters' });
			res.end();
		}
	} else {
		// pass to not found
		next();
	}
});

//app.param('suggest', /^[\d\w]+$/);

app.get('/airportSuggest/:suggest', function(req, res, next) {
	if ((req.xhr) && 
		(req.accepts('json')) &&
		(/^[-\d\w(), \\\/]+$/.test(req.param("suggest")))) {
			fh.airportSuggest(req.param("suggest"), function(err, data) {
				if (err) {
					// pass error
					//next(err);
					res.json({ status: "fail", message: 'No data' });
					res.end();
				} else {
					res.json({ status: "success", data: data });
					res.end();
				}
			});
	} else {
		res.json({ status: "fail", message: 'Bad parameter' });
		res.end();
	}
});

// not found handler
app.get('*', function(req, res) {
	res.status(404);

	if ((req.xhr) && (req.accepts('json'))) {
		res.json({ status: "error", message: 'Not found' });
	} else {
		res.send('Not found');
	}

	res.end();
});

// default request error handler
app.use(function(err, req, res, next) {
	res.status(500);

	if ((req.xhr) && (req.accepts('json'))) {
		res.json({ status: "error", message: 'Internal Server Error' });
	} else {
		res.send('Internal Server Error');
	}

	res.end();
	// trace error
	console.error("Error [http]", err);
	console.trace();
});

var server = http.createServer(app).listen(config.httpPort, function() {
	console.log('Info [http] binding new worker with pid', process.pid, 'to', config.httpPort, 'port');
});

server.on('connection', function(socket) {
	// setup keepAlive timeout
	socket.setTimeout(config.keepAlive);
});

module.exports = server;
