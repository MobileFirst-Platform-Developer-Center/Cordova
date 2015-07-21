
var mfpreadyfired = false;
document.addEventListener('deviceready', loadMFP, false);
function loadMFP(){
	if(typeof WL !== 'undefined' && WL.StaticAppProps){
		//console.log('Developer is injecting scripts manually');
		/*
		<script src="worklight/static_app_props.js"></script>
		<script src="cordova.js"></script>
		<script src="worklight/wljq.js"></script>
		<script src="worklight/worklight.js"></script>
		<script src="worklight/checksum.js"></script>
		*/
		mfpready();
	} else {
		//console.log('Inject MFP Scripts dynamically');
		loadStaticAppProps();
	}

	function loadStaticAppProps(){
		//console.log("worklight/static_app_props.js");
		injectScript("worklight/static_app_props.js",loadJQ,bootError);
	}
	
	function loadJQ(){
		//console.log("injecting script wljq.js");
		injectScript("worklight/wljq.js",loadWorklight,bootError);
	}
	
    function loadWorklight(){
		//console.log("injecting script worklight.js");
		injectScript("worklight/worklight.js",loadChecksum,bootError);
	}
	
	function loadChecksum (){
		//console.log("injecting script checksum.js");
		injectScript("worklight/checksum.js",mfpready,bootError);
	}
	
	function mfpready (){
		mfpFire();
		//call WL.Client.init unless user defined mfpManualInit = true in config.xml, and propagated to static_app_props.js
		if(WL.StaticAppProps && !WL.StaticAppProps.mfpManualInit){
			console.log('Calling WL.Client.init(wlInitOptions);')
			WL.Client.init(wlInitOptions);
		} else {
			//console.log('Developer will call WL.Client.init manually');
		}
		//Inform developer they should load their own jquery and not use MFP internal version
		deprecateWLJQ();
	}
	
	function mfpFire(){
        var env = cordova.platformId;
        if (env === "ios") {
            cordova.exec(null,null,"WLApp","writeUserPref", [{'key' : 'wlSkinName', 'value': 'default'}] );
        }
        else if (env === "android") {
            cordova.exec(null, null, "WLApp", "writeUserPref", ["wlSkinName", 'default']);
        }
        
		//console.log("bootstrap.js dispatching mfpready event");
		var wlevent = new Event('mfpready');
		// Dispatch the event.
		document.dispatchEvent(wlevent);
		mfpreadyfired = true;
	}
	
	function deprecateWLJQ(){
		setTimeout(function checkWLJQ(){
			if(window.$ === WLJQ){
				console.error('Using WLJQ as your window.$ is deprecated, if needed, please load your own JQuery instance');
			} else if(window.jQuery === WLJQ){
				console.error('Using WLJQ as your window.jQuery is deprecated, if needed, please load your own JQuery instance');
			}
		},10000);
	}
	
	function injectScript(url, onload, onerror) {
	    var script = document.createElement("script");
	    // onload fires even when script fails loads with an error.
	    script.onload = onload;
	    // onerror fires for malformed URLs.
	    script.onerror = onerror;
	    script.src = url;
	    document.head.appendChild(script);
	}
	
	function bootError(){
		console.error("mfp bootstrap failed to inject script");
	}


}
setTimeout(function mfpTimeOut(){
 if(!mfpreadyfired){
	 loadMFP();
 }
},6000);
