import { geolocation } from "geolocation";
import * as messaging from "messaging";
import * as graphql from "graphql-fitbit/companion";

var index = 1;

console.log("App started");

var GPSoptions = {
  enableHighAccuracy: false,
  maximumAge: 60000
};

function locationError(error) {
  console.log("Error fetching location");
  sendResponse({error:true,message:"no_location"});
}

function getStations(position) {
  var latitude, longitude;

  latitude = position.coords.latitude;
  longitude = position.coords.longitude;

  //@Test
  /*var location_chosen = 0;
  latitude = [48.139892, 52.571139][location_chosen];
  longitude = [11.655034, 13.398327][location_chosen];*/

  console.log("Location: "+latitude+", "+longitude);

  const body = {
      method: 'GET',
      headers: {
          'X-MVG-Authorization-Key': '5af1beca494712ed38d313714d4caff6'
      },
  };
  var url = "https://api.entur.org/api/geocoder/1.1/reverse?point.lat="+latitude+"&point.lon="+longitude+"&lang=en&layers=venue";
  console.log("Loading data from "+url);
  fetch(url, body).then(function (response) {
      response.text()
      .then(function(data) {
        //console.log(data);
        var data = JSON.parse(data);
        console.log(data);
        if(data["features"] == []){
          sendResponse({error:true,message:"nothing_found"});
        }else{
          var searched_index = 0;
          for(var i = 0;i<data["features"].length;i++){
            if(data["features"][i]["properties"]["id"]!=undefined){
               searched_index++;
            }
            if(data["features"][i]["properties"]["id"]!=undefined && searched_index >= index){

              const query = `{
                stopPlace(id: "` + data["features"][i]["properties"]["id"] + `") {
                  id
                  name
                  estimatedCalls(startTime:"2018-12-14T13:00:00+0200" timeRange: 72100, numberOfDepartures: 10) {
                    realtime
                    aimedArrivalTime
                    aimedDepartureTime
                    expectedArrivalTime
                    expectedDepartureTime
                    actualArrivalTime
                    actualDepartureTime
                    date
                    forBoarding
                    forAlighting
                    destinationDisplay {
                      frontText
                    }
                    quay {
                      id
                    }
                    serviceJourney {
                      journeyPattern {
                        line {
                          id
                          name
                          transportMode
                        }
                      }
                    }
                  }
                }
              }`;

              graphql.requestGraphQL('https://api.entur.org/journeyplanner/2.0/index/graphql', query, graphQLResponse, true);
          }
        } //end for
      } //end if
    })
  })
  .catch(function (err) {
    console.log("Error fetching: " + err);
  });
}

function graphQLResponse(data){
  console.log(data);
  var data = data["data"]["stopPlace"];
  var data_response = {
    name: data["name"],
    to:[],
    departures:[],
    number:[],
    operators:[]
  }
  for(var ia=0;ia < 4;ia++){
    //console.log(ia+": "+data2["stationboard"][ia]["to"]);
    try{
    data_response.to[ia] = data["estimatedCalls"][ia]["destinationDisplay"]["frontText"];
    data_response.departures[ia] = (new Date(data["estimatedCalls"][ia]["expectedDepartureTime"])).getTime()/1000;
    data_response.number[ia] = data["estimatedCalls"][ia]["serviceJourney"]["journeyPattern"]["line"]["id"].split(":")[2]; //Format: "HED:Line:701"
    data_response.operators[ia] = data["estimatedCalls"][ia]["serviceJourney"]["journeyPattern"]["line"]["transportMode"].toUpperCase();
    }catch(e){

    }
  }

  console.log(data_response)
  sendResponse(data_response);
}

function sendResponse(response){
  if (messaging.peerSocket.readyState === messaging.peerSocket.OPEN) {
    // Send a command to the device
    console.log("Sending response");
    console.log(JSON.stringify(response));
    messaging.peerSocket.send(response);
  } else {
    console.log("Error: Connection is not open");
  }
}

messaging.peerSocket.onopen = function() {
  console.log("Socket open");
  geolocation.getCurrentPosition(getStations, locationError, GPSoptions);
}

// Listen for messages from the device
messaging.peerSocket.onmessage = function(evt) {
  if(evt.data.key=="changeStationDown"){
    index++;
    geolocation.getCurrentPosition(getStations, locationError, GPSoptions);
  }else if(evt.data.key=="changeStationUp"){
    index--;
    geolocation.getCurrentPosition(getStations, locationError, GPSoptions);
  }
}

// Listen for the onerror event
messaging.peerSocket.onerror = function(err) {
  // Handle any errors
  console.log("Connection error: " + err.code + " - " + err.message);
}
