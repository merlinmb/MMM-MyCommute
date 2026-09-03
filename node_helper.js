/* Magic Mirror
 * Module: mrx-work-traffic
 *
 * By Dominic Marx
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var axios = require('axios');
var moment = require('moment');
 
module.exports = NodeHelper.create({

  start: function() {
    console.log("====================== Starting node_helper for module [" + this.name + "]");
  },
  
  
  // subclass socketNotificationReceived
  socketNotificationReceived: function(notification, payload){
    if (notification === 'GOOGLE_TRAFFIC_GET') {

      //first data opull after new config
      this.getPredictions(payload);

    }
  },


	
	getPredictions: function(payload) {
		var self = this;

    var returned = 0;
    var predictions = new Array();

		payload.destinations.forEach(function(dest, index) {
      // Log the request being sent
      console.log("MMM-MyCommute: Sending request for " + dest.config.label);
      console.log("  Departure time: " + dest.body.departureTime);
      console.log("  Travel mode: " + dest.body.travelMode);
      console.log("  Routing preference: " + dest.body.routingPreference);

			axios.post('https://routes.googleapis.com/directions/v2:computeRoutes', dest.body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': payload.apikey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
        }
      }).then(function(response) {

        var prediction = new Object({
          config: dest.config
        });

        var data = response.data;

        if (data.error) {
          console.log("MMM-MyCommute: " + JSON.stringify(data.error));
          prediction.error = true;
        } else if (data.routes && data.routes.length > 0) {

          var routeList = new Array();
          for (var i = 0; i < data.routes.length; i++) {
            var r = data.routes[i];
            var duration = self.parseDuration(r.duration);

            var routeObj = new Object({
              summary: 'Route ' + (i + 1),
              time: duration
            });

            routeList.push(routeObj);
          }

          // Log all routes returned
          console.log("MMM-MyCommute: " + dest.config.label + " - Found " + routeList.length + " routes:");
          routeList.forEach(function(route, idx) {
            console.log("  Route " + (idx + 1) + ": " + route.time + " seconds (" + Math.round(route.time / 60) + " min)");
          });

          // Sort by duration (fastest first)
          routeList.sort(function(a, b) {
            return a.time - b.time;
          });

          console.log("MMM-MyCommute: Fastest route for " + dest.config.label + " is " + Math.round(routeList[0].time / 60) + " min");

          prediction.routes = routeList;

        } else {
          prediction.error = true;
        }

        predictions[index] = prediction;
        returned++;

        if (returned == payload.destinations.length) {
          self.sendSocketNotification('GOOGLE_TRAFFIC_RESPONSE' + payload.instanceId, predictions);
        };

      }).catch(function(error) {
        var msg = "Error getting traffic prediction: " + error.message;
        if (error.response && error.response.data) {
          msg += " - " + JSON.stringify(error.response.data);
        }
        console.log(msg);
        var prediction = new Object({
          config: dest.config,
          error: true
        });
        predictions[index] = prediction;
        returned++;

        if (returned == payload.destinations.length) {
          self.sendSocketNotification('GOOGLE_TRAFFIC_RESPONSE' + payload.instanceId, predictions);
        };
      });
    });
	},

	parseDuration: function(duration) {
		if (typeof duration === 'string') {
			var match = duration.match(/(\d+)s/);
			if (match) {
				return parseInt(match[1]);
			}
		} else if (typeof duration === 'object' && duration.seconds) {
			return parseInt(duration.seconds);
		}
		return 0;
	}
	
});