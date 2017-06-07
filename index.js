'use strict';

const Hapi = require('hapi');
const Joi = require('joi');
const Axios = require('axios');
const SunCalc = require('suncalc');

const apiSnippet = require('./api_snippet');

const willy_key = process.env.WILLY_KEY;

// coordinates will be stored as a string to make them easy to look up
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
const getLight = (sun) => {
  const {
    dawn,
    sunriseEnd: day,
    sunsetStart: dusk,
    dusk: night
  } = sun;

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

// api for searching for stations based on coordinates
const searchStationApi = ({lat, lng}) => {
  return new Promise((res, rej) => {
    res({
      status: 200,
      data: apiSnippet.station
    });
    return;
  })
    .then((res) => {
      if (res.status == 200) {
        return res.data;
      }

      console.log(res);
      throw new Error(`Willy Weather API failed while getting closest station to ${lat}, ${lng}`);
    });
};

// find the closes station
const getClosestStation = (coord) => {
  return new Promise((res, rej) => {
    // look in cache
    const cachedStation = cache.station[cacheCoord(coord)];
    if (typeof cachedStation != 'undefined') {
      console.log(`cached: ${cachedStation}`);
      res(cachedStation);
      return;
    }

    // hit the api to find the closest station
    searchStationApi(coord)
      .then((data) => data.location.id)
      .then((station) => {
        // cache the data
        console.log(`add to cache: ${station}`);
        cache.station[cacheCoord(coord)] = station;

        res(station);
        return;
      })
      .catch((err) => {
        console.error(err);
        rej('Error in getClosestStation');
        return;
      });
    return;
  });
};

// api for getting weather information of a station
const getWeatherApi = (station) => {
  return new Promise((res, rej) => {
    res({
      status: 200,
      data: apiSnippet.weather
    });
    return;
  })
    .then((res) => {
      if (res.status == 200) {
        return res.data;
      }
      console.log(res);
      throw new Error(`Willy Weather API failed while getting weather data from station ${station}`);
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

    // hit the api to get weather info for the station
    getWeatherApi(station)
      .then((data) => data.observational.observations.rainfall.todayAmount)
      .then((rainfall) => {
        // cache the data (expires in an hour)
        console.log(`add to cache: ${rainfall}`);
        cache.rainfall[station] = {
          value: rainfall,
          expire: (Date.now() / 1000) + 3600
        };

        res(rainfall);
        return;
      });
    return;
  });
}

// get wetnees of a location
const getWetness = (coord) => {
  return new Promise((res, rej) => {
    // chain getting station and getting rainfall
    getClosestStation(coord)
      .then((station) => getRainfall(station))
      .then((rainfall) => {
        if (rainfall > 0) {
          res(true);
          return;
        }
        res(false);
        return;
      })
      .catch((err) => {
        console.error(err);
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
        const sun = getSunTimes(coord);
        // add conditions to response
        Object.assign(response, {
          dayStart: Math.floor(sun.dawn),
          dayEnd: Math.floor(sun.night),
          light: getLight(sun),
          wet
        });

        console.log(response);
        reply(response);
        return;
      })
      .catch((err) => {
        console.log(req);
        console.error(err);
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
