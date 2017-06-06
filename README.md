NOTE: This branch is for dev purposes only (the data is only for one location and is not live)

# API server for LLogger android app
Returns the current road conditions at a coordinate.

## Usage
You need the latitude and longitude of a location.  
`/drive_conditions?lat=-37.8106&lng=144.9643` will respond with  
```
{
	"statusCode": 200,
	"coord": {
		"lat": "-37.8",
		"lng": "145.0"
	},
	"light": "night",
	"wet": true
}
```

## Installation 
`yarn`  
`WILLY_KEY=my_willy_weather_key yarn start`  
🔥🔥
