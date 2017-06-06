'use strict';

const Hapi = require('hapi');
const Joi = require('joi');
const Axios = require('axios');
const SunCalc = require('suncalc');

// coordinates will be stored in way that are easy to look up
const cacheCoord = ({lat, lng}) => `${lat},${lng}`;

const cache = {
  rainfall: {},
  station: {}
};

// get the sun times for the location
const getSunTimes = ({lat, lng}) => {
  // calculate the sun times
  const times = SunCalc.getTimes(Date.now(), lat, lng);
  // convert to timestamp
  return Object.keys(times).reduce((acc, key) => {
    acc[key] = times[key].getTime() / 1000;
    return acc;
  }, {});

};

// get light status of the location
const getLight = (coord) => {
  const {
    dawn,
    sunriseEnd: day,
    sunsetStart: dusk,
    dusk: night
  } = getSunTimes(coord);

  const now = Date.now() / 1000;
  // before dawn is night, and etc. etc.
  if (now < dawn) {
    return 'night';
  }
  if (now < day) {
    return 'dawn/dusk';
  }
  if (now < dusk) {
    return 'day';
  }
  if (now < night) {
    return 'dawn/dusk';
  }
  return 'night';
};

// find the closes station
const getClosesStation = (coord) => {
  return new Promise((res, rej) => {
    // look in cache
    const cachedStation = cache.station[cacheCoord(coord)];
    if (typeof cachedStation != 'undefined') {
      console.log(`cached: ${cachedStation}`);
      res(cachedStation);
      return;
    }
    // do work
    const station = 123;
    // cache the data
    console.log(`add to cache: ${station}`);
    cache.station[cacheCoord(coord)] = station;

    res(station);
    return;
  });
};

// get rainfall of a station
const getRainfall = (station) => {
  return new Promise((res, rej) => {
    // look in cache
    const cachedRainfall = cache.rainfall[station];
    if (typeof cachedRainfall != 'undefined' && cachedRainfall.expire > (Date.now() / 1000)) {
      console.log(`cached: ${cachedRainfall.value}`);
      res(cachedRainfall.value);
      return;
    }
    // do work
    const rainfall = 22;
    // cache the data
    console.log(`add to cache: ${rainfall}`);
    cache.rainfall[station] = {
      value: rainfall,
      expire: (Date.now() / 1000) + 3600
    };

    res(rainfall);
    return;
  });
}

// get wetnees of a location
const getWetness = (coord) => {
  return new Promise((res, rej) => {
    // chain getting station and getting rainfall
    getClosesStation(coord)
      .then((station) => getRainfall(station))
      .then((rainfall) => {
        // 20 is an arbitrary number for now
        if (rainfall > 20) {
          res(true);
          return;
        }
        res(false);
        return;
      })
      .catch((err) => {
        console.log(err);
        rej('Error in getWetness');
        return;
      });
    return;
  });

};

// Create a server with a host and port
const server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000
});

// Add driving condition route
server.route({
  method: 'GET',
  path:'/drive_conditions',
  handler: function (req, reply) {
    console.log(cache);

    const coord = {
      lat: req.query.lat.toFixed(1),
      lng: req.query.lng.toFixed(1)
    };
    const response = {
      statusCode: 200,
      coord
    };

    getWetness(coord)
      .then((wet) => {
        // add conditions to response
        Object.assign(response, {
          light: getLight(coord),
          wet
        });

        console.log(response);
        reply(response);
        return;
      })
      .catch((err) => {
        // console.log(req);
        console.log(err);
        reply(new Error());
      });
    return;
  },
  config: {
    validate: {
      query: {
        lat: Joi.number().required(),
        lng: Joi.number().required()
      }
    }
  }
});

// Start the server
server.start((err) => {
  if (err) {
      throw err;
  }
  console.log(`Server running at: ${server.info.uri}`);
});
