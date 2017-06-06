'use strict';

const Hapi = require('hapi');
const Joi = require('joi');

const cacheCoord = ({lat, lng}) => `${lat},${lng}`;

const cache = {
  sun:  {},
  rainfall: {},
  station: {}
};

const getSunTimes = ({lat, lng}) => {

};

const getLight = ({lat, lng}) => {

};

const getClosesStation = (coord) => {
  return new Promise((res, rej) => {
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

const getRainfall = (station) => {
  return new Promise((res, rej) => {
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

const getWetness = (coord) => {
  return new Promise((res, rej) => {
    getClosesStation(coord)
      .then((station) => getRainfall(station))
      .then((rainfall) => {
        if (rainfall > 20) {
          res(true);
          return;
        }
        res(false);
        return;
      })
    return;
  });

};

// Create a server with a host and port
const server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000
});

// Add the route
server.route({
  method: 'GET',
  path:'/drive_conditions',
  handler: function (req, reply) {
    console.log(cache);
    // construct coordinates for getting sunset/sunrise
    const sunCoord = {
      lat: Math.floor(req.query.lat),
      lng: Math.floor(req.query.lng)
    };
    // construct more accurate coordinates for getting rainfall
    const rainCoord = {
      lat: req.query.lat.toFixed(1),
      lng: req.query.lng.toFixed(1)
    };
    const response = {
      sunCoord,
      rainCoord
    };

    // find the closes station
    Promise.all([
      getLight(sunCoord),
      getWetness(rainCoord)
    ])
      .then((response) => {
        Object.assign(response, {response});
        reply(response);
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
