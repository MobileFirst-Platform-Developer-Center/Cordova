/*
 * This hook will:
 * 1) read the properties from application-descriptor.xml
 * and copy them into a more generic artifact: www/worklight/static_app_props.js.
 * Then boot.js will inject static_app_props.js into the webpage to get those
 * values loaded.
 * 2) update the client properties file (wlcient.properties, worklight.plist)
 * with the mfp server url info from config.xml
 */

var path = require('path'),
    fs = require('fs'),
    url = require('url'),
    os = require('os'),
    crypto = require('crypto'),
	et = require('elementtree'),
	plist = require('plist'),
    shell = require('shelljs'),
    strings = require('strings'),
    externalizedStrings = require('./externalizedStrings');

// will be required from cordova-lib in main function
var ConfigParser;

// this timestamp will get used consistently below so it has the same value
var now = new Date();

module.exports = function(context) {
  //global module to be share globally in this module
  ConfigParser = context.requireCordovaModule('cordova-lib').configparser;

  if (context.hook === 'before_plugin_uninstall') {
    return uninstallPlugin(context);
  }

  // uncomment the following line to get a breakpoint when this starts running since it gets loaded dynamically
  // debugger;

  if (context.hook === 'before_prepare') {
	return beforePrepare(context);
  }

  if (context.hook === 'after_prepare') {
	return prepare(context);
  }
};

/*
 * Performs actions before prepare occurs. For instance, the checksum.js
 * file is copied into a temporary location so that it can be moved back
 * after prepare.
 */
function beforePrepare(context) {
	var checksumFile;		// Checksum file name and path
	var platformPath;		// Path to platforms folder
	var projectRoot;		// Project directory
	var currentPlatforms;	// Platforms to prepare

	currentPlatforms = context.opts.cordova.platforms;
	projectRoot = path.resolve(context.opts.projectRoot);

	// If the user did not supply any platforms, use all the installed platforms
	if (currentPlatforms.length === 0)
		currentPlatforms = getInstalledPlatforms(path.join(projectRoot,
				'platforms'));

	// Determine the location of the checksum.js file for the provided
	// platforms
	currentPlatforms.forEach(
			 function(platformId) {

					platformPath = path.join(projectRoot, 'platforms',
							platformId);

					// Determine the checksum.js path for a specific platform
				    if (platformId === 'ios') {
				        var cdvProjName =
				        	fs.readdirSync(platformPath).filter(
				        			function(e) {
				        				return e.match(/\.xcodeproj$/i);
				        				}
				        			)[0];

				        cdvProjName = cdvProjName.substring(0,
				        		cdvProjName.indexOf('.xcodeproj'));
				        checksumFile = path.join(platformPath, 'www',
				        		'worklight', 'checksum.js');
				    } else if (platformId === 'android') {
				     	checksumFile = path.join(platformPath, 'assets', 'www',
				     			'worklight', 'checksum.js');
				     	
				     	// Moves filelist to another directory if it exists
				     	var filelist = path.join(platformPath, 'assets', 'www', 'filelist');
				     	if (fs.existsSync(filelist)) {
				     		moveFile(filelist, path.join(platformPath, 'filelist'));
				     	}
				     	else {
				     		console.log(externalizedStrings.filelistMissing);
				     	}
					} else {
				    	console.warn(strings.format(externalizedStrings.hookNotImpl, platformId));
				    	return;
				    }

				    // Move the checksum.js file to a temporary directory
				    if (fs.existsSync(checksumFile)) {
				  	  moveFile(checksumFile, path.join(platformPath,
				  			  'checksum.js'));
				    } else
				    	console.log(externalizedStrings.checksumMissing);

			 }
	 )
}

/**
 * Kickoff the work:
 * 1) iterate through platforms and do platform-specific stuff (i.e.: iOS's main.m)
 * 2) build static_app_props.js
 * 3) Update the client prop file (i.e., wlclient.properties on Android) with mfp server url from config.xml
 */
function prepare(context) {
  var propFile;
  var parser;
  var platformPath;
  var currentPlatforms = context.opts.cordova.platforms;
  var projectRoot = path.resolve(context.opts.projectRoot);
  var platforms = context.requireCordovaModule(path.join('..', 'platforms', 'platforms'));
  var pluginID = context.opts.plugin.id;
  var pluginDir = context.opts.plugin.dir;

  console.log(strings.format(externalizedStrings.runningWlHook, pluginID));

  //console.log(JSON.stringify(context,null,2));
  //console.log(process.cwd());
  //console.log(JSON.stringify(currentPlatforms));

  // If the user did not supply any platforms, use all the installed platforms
  if (currentPlatforms.length === 0)
	  currentPlatforms = getInstalledPlatforms(path.join(projectRoot,
			  'platforms'));

  currentPlatforms.forEach(function(platformId) {
    // get the WL server URL from config.xml
    var config = new ConfigParser(path.join(projectRoot, 'config.xml'));
    var wlServerUrl = config.getPreference('mfpServerUrl', platformId); // platform id means run inside loop
    var wlServerRuntime = config.getPreference('mfpServerRuntime', platformId); // platform id means run inside loop

    if (!wlServerUrl) {
      throw new Error('Unable to find preference "mfpServerUrl" in config.xml');
    }

    if (!wlServerRuntime) {
      throw new Error('Unable to find preference "mfpServerRuntime" in config.xml');
    }

    var wlServer = { };
    var parsedUrl = url.parse(wlServerUrl);
    var checksumFile;
    var checksumFile2;
    var skinLoaderPath;
    var mainHTML;

    wlServer.protocol = parsedUrl.protocol;
    // remove the trailing colon
    var colonIndex = wlServer.protocol.indexOf(':');
    if (colonIndex > 0) {
      wlServer.protocol = wlServer.protocol.substring(0, colonIndex);
    }
    wlServer.host = parsedUrl.hostname;
    wlServer.port = parsedUrl.port;
    if (!wlServer.port) {
      if (wlServer.protocol === 'https') {
        wlServer.port = 443;
      } else {
        wlServer.port = 80;
      }
    }

    wlServer.context = wlServerRuntime;

    platformPath = path.join(projectRoot, 'platforms', platformId);
    parser = new platforms[platformId].parser(platformPath);

    if (platformId === 'ios') {
        var cdvProjName = fs.readdirSync(platformPath).filter(function(e) { return e.match(/\.xcodeproj$/i); })[0];
        cdvProjName = cdvProjName.substring(0, cdvProjName.indexOf('.xcodeproj'));

        // Determine if the wlclient.properties file exists
    	if (!fs.existsSync(path.join(platformPath, cdvProjName, 'Resources', 'worklight.plist'))) {
      	  console.log(externalizedStrings.worklightPlistMissing);
      	  return;
        }

        // compute the name of the client property file for updateClientPropFile()
        propFile = path.join(platformPath, cdvProjName, 'Resources', 'worklight.plist');
        parseUpdate(projectRoot, platformPath, platformId);
        checksumFile = path.join(platformPath, 'www', 'worklight',
	  		'checksum.js');
        checksumFile2 = path.join(platformPath, 'www', 'default', 'worklight',
	  		'checksum.js');

        //update Resources/VERSION from CordovaLibVERSION
        shell.cp('-f', path.join(platformPath, 'CordovaLib', 'VERSION'), path.join(platformPath, cdvProjName, 'Resources','VERSION'));

        skinLoaderPath = path.join(platformPath, 'www', 'skinLoader.html');
        //\platforms\ios\www\skinLoader.html
    } else if (platformId === 'android') {
      // Determine if the wlclient.properties exist
      if (!fs.existsSync(path.join(platformPath, 'assets', 'wlclient.properties'))) {
      	console.log(externalizedStrings.wlclientPropertiesMissing);
      	return;
      }

      propFile = path.join(platformPath, 'assets', 'wlclient.properties');
      parseUpdate(projectRoot, platformPath, platformId);
      checksumFile = path.join(platformPath, 'assets', 'www', 'worklight',
	  		'checksum.js');
      checksumFile2 = path.join(platformPath, 'assets', 'www', 'default', 'worklight',
	  		'checksum.js');

      skinLoaderPath = path.join(platformPath, 'assets', 'www', 'skinLoader.html');
      
      // Move filelist back to asset/www folder if it exists
      var filelist = path.join(platformPath, 'assets', 'www', 'filelist');
      if (fs.existsSync(path.join(platformPath, 'filelist'))) {
    	  moveFile(path.join(platformPath, 'filelist'), filelist);
      }
      else {
    	  console.log(externalizedStrings.filelistMissing);
      }
      
    } else {
      console.warn(strings.format(externalizedStrings.hookNotImpl, platformId));
      return;
    }

    updateClientPropFile(platformId, wlServer, parser, propFile);
    buildStaticAppProps(platformId, parser, propFile, config);


	// Move the checksum.js back to the assets directory
    if (fs.existsSync(path.join(platformPath, 'checksum.js'))) {
	  	moveFile(path.join(platformPath, 'checksum.js'), checksumFile);
        copyFile(checksumFile, checksumFile2);
    } else
    	console.log(externalizedStrings.checksumMissing);

    mainHTML = config.doc.findall('content')[0].attrib.src;

    // Update the name of the main html file in the skinLoader.html file
    if (mainHTML && fs.existsSync(skinLoaderPath))
    	replaceValueInFile(skinLoaderPath, 'index.html', mainHTML);

    updateTemplatedFiles(platformId, config, platformPath, propFile);
  });


}

/*
 * Replaces a string in a file with a specified value.
 */
function replaceValueInFile(path, toReplace, replaceWith) {
	  var content;		// Contents of file

	// Attempt to read the file
	  fs.readFile(path, function (err, data) {
		  if (err) {
			  console.log(err.message);
	    	  return;
		  }

	  content = data.toString();
	  content = content.replace(toReplace, replaceWith);

	  // Attempt to write the file
	  fs.writeFile(path, content, function(err) {
		  if (err) {
			  console.log(err.message);
	    	  return;
		  }
		});
	  });
}

/*
 * Returns all of the installed platforms in an array. If no platforms are
 * installed, an empty array is returned.
 */
function getInstalledPlatforms(platformDir) {
	var installedPlatforms;

	installedPlatforms = [];

	// Attempt to get all of the installed platforms
	try {
		installedPlatforms = fs.readdirSync(platformDir);

		// Filter files from the platform array
		installedPlatforms = installedPlatforms.filter(function (value) {
			return fs.lstatSync(path.join(platformDir, value)).isDirectory();
	    });
	} catch (err) {
		console.log(externalizedStrings.noPlatformsDetected);
	}

	return installedPlatforms;
}

/**
 * Update the client properties file, such as wlclient.properties for Android,
 * and worklight.plist for iOS, with the mfp server url info from config.xml
 */
function updateClientPropFile(platformId, wlServer, parser, propFile) {
    console.log(strings.format(externalizedStrings.updatingClientProp, platformId));

    if (platformId === 'android') {
        shell.sed('-i', /wlServerProtocol.*/g, 'wlServerProtocol = ' + wlServer.protocol, propFile);
        shell.sed('-i', /wlServerHost.*/g, 'wlServerHost = ' + wlServer.host, propFile);
        shell.sed('-i', /wlServerPort.*/g, 'wlServerPort = ' + wlServer.port, propFile);
        shell.sed('-i', /wlServerContext.*/g, 'wlServerContext = /' + wlServer.context + '/', propFile);
    }
    else if (platformId === 'ios') {
        //update server values in plist file
        var plistInfo = plist.parse(fs.readFileSync(propFile, 'utf8'));
        plistInfo['protocol'] = wlServer.protocol;
        plistInfo['host'] = wlServer.host;
        plistInfo['port'] = wlServer.port;
        plistInfo['wlServerContext'] = '/' + wlServer.context + '/';

        var updatedPlist = plist.build(plistInfo);
        fs.writeFileSync(propFile, updatedPlist, 'utf8');
    }
}


/*
 * build the WL.StaticAppProp values from WL's application-descriptor.xml and
 * store it in www/worklight/static_app_props.js
 * So why does WL need both the static_app_props and wlclient.properties? Seems duplicate.
 */
function buildStaticAppProps(platformId, parser, propFile, configFile) {
  console.log(strings.format(externalizedStrings.buildingStaticAppProps, platformId));

  var appProps = { };
  appProps.APP_DISPLAY_NAME = configFile.getPreference('displayName', platformId) || configFile.name();

  appProps.APP_SERVICES_URL = "/apps/services/";

  if (platformId === 'android') {
    appProps.APP_ID = getAndroidProperty('wlAppId', propFile);
    appProps.APP_VERSION = getAndroidProperty('wlAppVersion', propFile);
    appProps.WORKLIGHT_PLATFORM_VERSION = getAndroidProperty('wlPlatformVersion', propFile);
    appProps.ENVIRONMENT = 'android';
  }
  else if (platformId === 'ios') {
    var plistInfo = plist.parse(fs.readFileSync(propFile, 'utf8'));
    appProps.APP_ID = plistInfo['application id'] || "";
    appProps.APP_VERSION = plistInfo['application version'] || "";
    appProps.WORKLIGHT_PLATFORM_VERSION = plistInfo['platformVersion'] || "";
    appProps.ENVIRONMENT = 'iphone';
  }

  appProps.LOGIN_DISPLAY_TYPE = configFile.getPreference('loginDisplay', platformId) || "embedded";
  appProps.WORKLIGHT_NATIVE_VERSION = configFile.getPreference('wlNativeVersion', platformId) || "";
  var mfpManualInit = configFile.getPreference('mfpManualInit', platformId);
  if (typeof mfpManualInit === 'string'){
      if(mfpManualInit === 'true'){
          mfpManualInit = true;
      } else {
          mfpManualInit = false;
      }
  } else if (typeof mfpManualInit !== 'boolean') {
      mfpManualInit = false;
  }

  appProps.mfpManualInit = mfpManualInit;

  appProps.WORKLIGHT_ROOT_URL = appProps.APP_SERVICES_URL + 'api/' + appProps.APP_ID + '/' + appProps.ENVIRONMENT + '/';

  var contents = '// This is a generated file. Do not edit. See application-descriptor.xml.' + '\n';
  contents += '// WLClient configuration variables.' + '\n';
  contents += 'console.log("' + externalizedStrings.runningStaticAppProps + '");' + '\n';
  contents += 'var WL = WL ? WL : {};' + '\n';
  contents += 'WL.StaticAppProps = ';
  contents += JSON.stringify(appProps, null, 2);
  contents += ';';

  var cdvWLStaticAppPropFile = path.join(parser.www_dir(), 'worklight', 'static_app_props.js');
  shell.mkdir('-p', path.dirname(cdvWLStaticAppPropFile));
  fs.writeFileSync(cdvWLStaticAppPropFile, contents, {
    encoding: 'utf8'
  });
}

/* Get android property from wlclient.properties */
function getAndroidProperty(property, propFile) {
    var value;
    value = shell.grep(property, propFile);
    if (!value) {
        return "";
    }
    value = value.split("=");
    return value[1].trim();
}

function uninstallPlugin(context) {
  console.log(externalizedStrings.uninstallingWlHook);

  var currentPlatforms = context.opts.cordova.platforms;
  var wlPropFile;
  var propFile;
  var parser;
  var platformPath;
  var cdvMainFile;
  var cdvMainFileBackup;
  var cdvProjName;
  var cdvWLStaticAppPropFile;
  var cdvchecksumDir;
  var projectRoot = path.resolve(context.opts.projectRoot);
  var platforms = context.requireCordovaModule(path.join('..', 'platforms', 'platforms'));

  currentPlatforms.forEach(function(platformId) {

    platformPath = path.join(projectRoot, 'platforms', platformId);
    parser = new platforms[platformId].parser(platformPath);
    cdvWLStaticAppPropFile = path.join(parser.www_dir(), 'worklight', 'static_app_props.js');
    cdvchecksumDir = path.join(parser.www_dir(), 'worklight', path.sep);

    shell.rm('-f', cdvWLStaticAppPropFile);
    shell.rm('-rf', cdvchecksumDir);

    if (platformId === 'ios') {
      cdvProjName = fs.readdirSync(platformPath).filter(function(e) { return e.match(/\.xcodeproj$/i); })[0];
      cdvProjName = cdvProjName.substring(0, cdvProjName.indexOf('.xcodeproj'));

      cdvMainFile = path.join(platformPath, cdvProjName, 'main.m');
      cdvMainFileBackup = cdvMainFile + '.bak';

      if (shell.test('-f', cdvMainFileBackup)){
        //restore main.m to original from backup
        moveFile(cdvMainFileBackup, cdvMainFile);
      }

    } else if (platformId === 'android') {
        propFile = path.join(platformPath, 'assets', 'wlclient.properties');
        shell.rm('-f', propFile);

        var manifestFile = fs.readFileSync(path.join(platformPath, 'AndroidManifest.xml')).toString();
        var manifest = et.parse(manifestFile);
        var orig_pkg = manifest.getroot().attrib.package;
        var orig_pkgDir = path.join(platformPath, 'src', path.join.apply(null, orig_pkg.split('.')));

        if (shell.test('-f', path.join(orig_pkgDir, 'MainActivity.original'))) {
            console.log(externalizedStrings.restoringOrigMainAct);
            // Delete CordovaApp.java
            shell.rm('-f', path.join(orig_pkgDir, 'CordovaApp.java'));

            // Find class name of original main activity
            var activityName = 'CordovaApp.java';
            var lines = fs.readFileSync(path.join(orig_pkgDir, 'MainActivity.original')).toString().split("\n");
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].indexOf('public class ') != -1) {
                    var splitArray = lines[i].split(" ");
                    activityName = splitArray[2] + '.java';
                    break;
                }
            }
            // Rename file to the original main activity name
            fs.renameSync(path.join(orig_pkgDir, 'MainActivity.original'), orig_pkgDir + path.sep + activityName);
            console.log(strings.format(externalizedStrings.origMainActRestoreSuccess, activityName));
        }
        else {
            console.log(externalizedStrings.origMainActRestoreFailure);
        }

        shell.rm('-f', path.join(orig_pkgDir, 'GCMIntentService.java'));
        shell.rm('-f', path.join(orig_pkgDir, 'ForegroundService.java'));
      } else {
        console.warn(strings.format(externalizedStrings.hookNotImpl, platformId));
      }
  });
}

function moveFile(srcFile, destFile) {
  shell.mkdir('-p', path.dirname(destFile));
  shell.mv('-f', srcFile, destFile);
}

function copyFile(wlFile, cdvFile) {
  shell.mkdir('-p', path.dirname(cdvFile));
  // dest file may already exist as read-only
  if (shell.test('-f', cdvFile)) {
    shell.chmod('u+w', cdvFile);
  }
  shell.cp('-f', wlFile, cdvFile);
}

/*
 * Handles the update tag in the config.xml
 */
function parseUpdate(projectRoot, platformPath, platformId) {
    var configString = fs.readFileSync(path.join(projectRoot, 'config.xml')).toString();
    var configEtree = et.parse(configString);

    updateFile(projectRoot, platformPath, configEtree.getroot());

    // check if platform specific
    var platforms = configEtree.findall('platform');
    if (platforms != null) {
        platforms.forEach(function(platform) {
            if (platform.get('name') == platformId) {
                updateFile(projectRoot, platformPath, platform);
                return;
            }
        });
    }
}

/*
 * Update the file of the destination with the source
 */
function updateFile(projectRoot, platformPath, element) {
    var files = element.findall('update');
    if (files != null) {
        files.forEach(function(file) {
            var srcFile = path.join(projectRoot, file.get('src'));
            var destFile = path.join(platformPath, file.get('target'));
            shell.cp('-f', srcFile, destFile);
        });
    }
}

/* Given an xml file, parse */
function parseXML(file) {
    var xmlRaw = fs.readFileSync(file).toString();
    return et.parse(xmlRaw);
}

/* Given the parsed xml tree, output it to given file */
function writeXML(tree, file) {
    var xmlString = tree.write({method:'xml', xml_declaration:true, indent:4});
    fs.writeFileSync(file, xmlString);
}

/* Update values that are templated */
function updateTemplatedFiles(platformId, config, platformPath, propFile) {
    //update file values
    if (platformId === 'android') {
        var xmlTree, file,
        appName = config.getPreference('displayName', platformId) || config.name(),
            wlplatformversion = getAndroidProperty('wlPlatformVersion', propFile);
        //update .externalToolBuilders/changeTimestamp.launch
        file = path.join(platformPath, '.externalToolBuilders', 'changeTimestamp.launch');
        xmlTree = parseXML(file);
        (xmlTree.find(".//stringAttribute[@key='org.eclipse.jdt.launching.PROJECT_ATTR']")).set('value', appName);
        writeXML(xmlTree, file);

        //update .idea/modules.xml
        file = path.join(platformPath, '.idea', 'modules.xml');
        xmlTree = parseXML(file);
        var xmlElement = xmlTree.find(".//module[@fileurl][@filepath]");
        xmlElement.set('fileurl', 'file://$PROJECT_DIR$/' + appName);
        xmlElement.set('filepath', '$PROJECT_DIR$/' + appName);
        writeXML(xmlTree, file);

        //update .idea/workspace.xml
        file = path.join(platformPath, '.idea', 'workspace.xml');
        xmlTree = parseXML(file);
        xmlElement = xmlTree.findall(".//ignored[@path]");
        for (var i = 0; i < xmlElement.length; i++) {
            if ((xmlElement[i].get('path')).match('.*iws')) {
                xmlElement[i].set('path', appName + '.iws');
            }
        }
        (xmlTree.find(".//favorites_list")).set('name', appName);
        xmlElement = xmlTree.findall(".//entry[@file]");
        for (var i = 0; i < xmlElement.length; i++) {
            xmlElement[i].set('file', 'file://$PROJECT_DIR$/' + appName + '.iml');
        }
        xmlElement = xmlTree.findall(".//option[@name='myItemId'][@value]");
        for (var i = 0; i < xmlElement.length; i++) {
            xmlElement[i].set('value', appName);
        }
        (xmlTree.find(".//component[@name='RunManager']")).set('selected', 'Android Application.' + appName);
        xmlElement = xmlTree.find(".//file[@current='true'][@current-in-tab='true'][@pinned='false']");
        xmlElement.set('leaf-file-name', appName + '.iml');
        xmlElement = xmlTree.find(".//configuration[@default='false'][@factoryName='Android Application'][@type='AndroidRunConfigurationType']");
        xmlElement.set('name', appName);
        (xmlElement.find(".//module")).set('name', appName);
        (xmlTree.find(".//item[@class='java.lang.String']")).set('itemvalue', 'Android Application.' + appName);
        writeXML(xmlTree, file);

        //update .idea/.name
        file = path.join(platformPath, '.idea', '.name');
        shell.sed('-i', /.*/, appName, file);

        //update .wldata
        file = path.join(platformPath, '.wldata');
        shell.sed('-i', /platformSourcesVersion.*/g, 'platformSourcesVersion=' + wlplatformversion, file);

        //rename .iml file to appName.iml
        fs.readdir(platformPath, function(err, files) {
            if (err) {
                console.log(strings.format(externalizedStrings.error, err));
                return;
            }
            for (var i = 0; i < files.length; i++) {
                if (path.extname(files[i]) === '.iml' && appName !== "") {
                    fs.rename(path.join(platformPath, files[i]), path.join(platformPath, appName + '.iml'), function(err) {
                        if (err)
                            console.log(strings.format(externalizedStrings.renameFileFail, files[i]));
                    });
                }
            }
        });

        //replace mfp-strings.xml element with app name
        var stringsXML = [path.join(platformPath, 'res', 'values', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-de', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-es', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-fr', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-he', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-it', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-iw', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-ja', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-ko', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-pt-rBR', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-ru', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-zh', 'mfp-strings.xml'),
                            path.join(platformPath, 'res', 'values-zh-rTW', 'mfp-strings.xml')];
        for (var i = 0; i < stringsXML.length; i++) {
            xmlTree = parseXML(stringsXML[i]);
            (xmlTree.find(".//string[@name='push_notification_title']")).text = appName;
            writeXML(xmlTree, stringsXML[i]);
        }

    } else if (platformId === 'ios') {
        var plistInfo = plist.parse(fs.readFileSync(propFile, 'utf8'));
        var wlplatformversion = plistInfo['platformVersion'] || "";
        //update .wldata
        file = path.join(platformPath, '.wldata');
        shell.sed('-i', /platformSourcesVersion.*/g, 'platformSourcesVersion=' + wlplatformversion, file);
    }
}
