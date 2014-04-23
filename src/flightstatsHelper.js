'use strict';

var qs = require('querystring'),
	cheerio = require('cheerio'),
	http = require('http');

var flightstars = function(config) {
	config = config || {};
	this._conf = config;
	this._conf.scheme = config.scheme || 'http';
	this._conf.host = config.host || 'www.flightstats.com';
	this._conf.timeout = config.timeout || 10000;
	this._conf.agent = config.agent || 'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:28.0) Gecko/20100101 Firefox/28.0';
};

flightstars.prototype._request = function(options, body, cb) {
	var sendBody = false;

	if (typeof(body) == 'function') {
		cb = body;
	} else {
		sendBody = true;
	}

	var req = http.request(options, function(res) {
		var fullData = '';

		if (res.statusCode != 200) {
			cb(new Error('Bad http status code'));
			req.abort();
		} else {
			res.on('end', function() 
			{
				cb(null, fullData); 
			});

			res.setEncoding('utf8');
			// collect data
			res.on('data', function(chunk) {
				fullData += chunk;
			});
			// on continue...
			res.on('continue', function() {

			});
		}
	});

	//abort request after timeout
	req.setTimeout(this._conf.timeout, function() {
		req.abort();
	});

	req.on('error', function(e) {
		req.abort();
		cb(new Error('Http connection error'));
	});

	if (sendBody) {
		req.write(body);
	}

	req.end();
};

flightstars.prototype._routeParser = function(html) {
	var dom = cheerio.load(html, {
			normalizeWhitespace: true,
			xmlMode: false,
			decodeEntities: true
		}),
		result = [];

	dom(".tableListingTable").find('tr').each(function(i, elem) {
		if (dom(elem).hasClass('tableHeader')) {
			return;
		}

		// extract data from inner tds
		var td = dom(elem).find('td'),
			record = {};
		if (td.length == 12) {
			dom(td).each(function(i, elem) {
				switch (i) {
					case 0:
						record.flight = dom(elem).find('a').text().trim();
						break;
					case 2:
						record.airline = dom(elem).text().trim();
						break;
					case 3:
						record.departureShed = dom(elem).text().trim();
						break;
					case 4:
						record.departureActual = dom(elem).text().trim();
						break;
					case 5:
						record.departureGate = dom(elem).text().trim();
						break;
					case 6:
						record.arrivalShed = dom(elem).text().trim();
						break;
					case 7:
						record.arrivalActual = dom(elem).text().trim();
						break;
					case 8:
						record.arrivalGate = dom(elem).text().trim();
						break;
					case 9:
						record.state = dom(elem).text().trim().replace(/\s+/g, ' ');
						break;
					case 10:
						record.equip = dom(elem).text().trim();
						break;
					default:
				}
			});
			result.push(record);
		}
	});

	return result;
};

flightstars.prototype.flightStatusByRoute = function(departure, arrival, date, cb) {
	var self = this,
		fields = {
			departure: departure,
			arrival: arrival,
			sortField: 3,
			codeshareDisplay: 0,
			queryNext: false,
			queryPrevious: true,
			departureDate: date
		},
		options = { 
			host: self._conf.host,
			path: '/go/FlightStatus/flightStatusByRoute.do?' + qs.stringify(fields),
			method: 'GET',
			headers: {
				'Accept': '*/*',
				'User-Agent': self._conf.agent,
			}	
		};

	self._request(options, function(err, data)
	{
		if (err) {
			cb(err);
		} else {
			// return parsed data
			cb(null, self._routeParser(data));
		}
	});
};

flightstars.prototype.airportSuggest = function(term, cb) {
	var self = this,
		fields = {
			responseType: 'json',
			desiredResults: 10,
			term: term
		},
		options = { 
			host: self._conf.host,
			path: '/go/Suggest/airportSuggest.do?' + qs.stringify(fields),
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'User-Agent': self._conf.agent,
				'X-Requested-With': 'XMLHttpRequest',
				'Referer': this._conf.scheme + '://' + self._conf.host + '/go/FlightStatus/flightStatusByRoute.do'
			}	
		};

	self._request(options, function(err, data)
	{
		if (err) {
			cb(err);
		} else {
			try {
				data = JSON.parse(data);
				// return parsed data
				cb(null, data);
			}
			catch (e) {
				cb(new Error('Bad json'));
			}			
		}
	});
};

module.exports = flightstars;
