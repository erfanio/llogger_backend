'use strict';

const Hapi = require('hapi');
const Joi = require('joi');
const Axios = require('axios');

// coordinates will be stored in way that are easy to look up
const cacheCoord = ({lat, lng}) => `${lat},${lng}`;

const cache = {
  sun:  {},
  rainfall: {},
  station: {}
};

// get the sun times for the location
const getSunTimes = (coord) => {
  return new Promise((res, rej) => {
    // look in cache
    const cachedSun = cache.sun[cacheCoord(coord)];
    if (typeof cachedSun != 'undefined') {
      console.log(`cached: sun`);
      res(cachedSun);
      return;
    }
    // do work
    const sun = {
      dawn: 1496692800,
      day: 1496696400,
      dusk: 1496732400,
      night: 1496734800
    };
    console.log(`add to cache: sun`);
    cache.sun[cacheCoord(coord)] = sun;

    res(sun);
    return;
  })
  .catch((err) => {
    console.log(err);
    rej('Error in getSunTimes');
    return;
  });
};

// get light status of the location
const getLight = (coord) => {
  return new Promise((res, rej) => {
    getSunTimes(coord)
      .then(({dawn, day, dusk, night}) => {
        const now = Date.now() / 1000;
        if (now < dawn) {
          res('night');
        } else if (now < day) {
          res('dawn/dusk');
        } else if (now < dusk) {
          res('day');
        } else if (now < night) {
          res('dawn/dusk');
        } else {
          res('night');
        }
        return;
      })
      .catch((err) => {
        console.log(err);
        rej('Error in getLight');
        return;
      });
  });
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
      query: req.query,
      sunCoord,
      rainCoord
    };

    // need both light and wetness
    Promise.all([
      getLight(sunCoord).then((light) => ({light})),
      getWetness(rainCoord).then((wet) => ({wet}))
    ])
      .then((conditions) => {
        // add conditions to response
        conditions.reduce((acc, item) => {
          return Object.assign(acc, item);
        }, response);

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
