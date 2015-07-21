/*
 *
    COPYRIGHT LICENSE: This information contains sample code provided in source code form. You may copy, modify, and distribute
    these sample programs in any form without payment to IBM® for the purposes of developing, using, marketing or distributing
    application programs conforming to the application programming interface for the operating platform for which the sample code is written.
    Notwithstanding anything to the contrary, IBM PROVIDES THE SAMPLE SOURCE CODE ON AN "AS IS" BASIS AND IBM DISCLAIMS ALL WARRANTIES,
    EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, ANY IMPLIED WARRANTIES OR CONDITIONS OF MERCHANTABILITY, SATISFACTORY QUALITY,
    FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND ANY WARRANTY OR CONDITION OF NON-INFRINGEMENT. IBM SHALL NOT BE LIABLE FOR ANY DIRECT,
    INDIRECT, INCIDENTAL, SPECIAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OR OPERATION OF THE SAMPLE SOURCE CODE.
    IBM HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS OR MODIFICATIONS TO THE SAMPLE SOURCE CODE.

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
