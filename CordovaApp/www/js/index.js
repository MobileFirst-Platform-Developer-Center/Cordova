/**
* Copyright 2015 IBM Corp.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var Messages = {
    // Add here your messages for the default language.
    // Generate a similar file with a language suffix containing the translated messages.
    // key1 : message1,
};

var wlInitOptions = {
    // Options to initialize with the WL.Client object.
    // For initialization options please refer to IBM MobileFirst Platform Foundation Knowledge Center.
};

// Called automatically after MFP framework initialization by WL.Client.init(wlInitOptions).
function wlCommonInit(){
	// Common initialization code goes here
    document.getElementById('menu').setAttribute('style', 'display:block;');
}

var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },

    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, 'app.receivedEvent(...);' must be explicitly called.
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
    },

    // Update the DOM on a received event.
    receivedEvent: function(id) {
    },
    // Trigger the vibration
    vibrate: function(){
        WL.Logger.info("vibrating");
        navigator.vibrate(3000);
    },
    // Trigger the camera
    getPicture: function(){
        navigator.camera.getPicture(app.getPictureSuccess, app.getPictureFail, { quality: 50,
            destinationType: Camera.DestinationType.FILE_URI });
    },
    // Receive the result from the camera
    getPictureSuccess: function(imageURI){
        WL.Logger.info("getPicture success "+imageURI);
        document.getElementById("image").src=imageURI;
    },
    // Called when some error occur with the camera
    getPictureFail: function(){
        WL.Logger.error("getPicture failed");
    },
    // Execute a request to RSSAdapter/getStories
    getRSSFeed: function(){
        var resourceRequest = new WLResourceRequest(
                    "/adapters/RSSAdapter/getStories",
                    WLResourceRequest.GET);
        resourceRequest.send().then(app.getRSSFeedSuccess,app.getRSSFeedError);
    },
    // Receive the response from RSSAdapter
    getRSSFeedSuccess:function(response){
        WL.Logger.info("getRSSFeedsSuccess");
        //The response.responseJSON contains the data received from the backend
        alert("Total RSS Feed items received:"+response.responseJSON.rss.channel.item.length);
    },
    // Called when some error occur during the request to RSSAdapter
    getRSSFeedError:function(response){
        WL.Logger.error("Response ERROR:"+JSON.stringify(response));
        alert("Response ERROR:"+JSON.stringify(response));
    }
};

app.initialize();
