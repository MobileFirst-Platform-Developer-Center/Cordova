/*
 * Runs after plugin install
 * For Android, copies over CordovaApp.java to be merged manually with the user's main Cordova activity
 */

var path = require('path'),
    fs = require('fs'),
	child = require('child_process'),
    shell = require('shelljs'),
    et = require('elementtree')
    strings = require('strings'),
    externalizedStrings = require('./externalizedStrings');

module.exports = function(context) {

    if (context.hook === 'after_plugin_install') {
      return afterPluginInstall(context);
    }
};

function afterPluginInstall(context) {
  console.log(externalizedStrings.pluginInstallComplete);

  var platformPath;
  var currentPlatforms = context.opts.cordova.platforms;
  var projectRoot = path.resolve(context.opts.projectRoot);
  var platforms = context.requireCordovaModule('../platforms/platforms');
  var pluginDir = context.opts.plugin.dir;

  currentPlatforms.forEach(function(platformId) {
    platformPath = path.join(projectRoot, 'platforms', platformId);

    if (platformId === 'android') {
      var manifestFile = fs.readFileSync(path.join(platformPath, 'AndroidManifest.xml')).toString();
      var manifest = et.parse(manifestFile);
      var orig_pkg = manifest.getroot().attrib.package;
      var orig_pkgDir = path.join(platformPath, 'src', path.join.apply(null, orig_pkg.split('.')));

	  // Finds java files that could be the CordovaActivity
      var java_files = fs.readdirSync(orig_pkgDir).filter(function(f) {
        return f.indexOf('.svn') == -1 && f.indexOf('.java') >= 0 && fs.readFileSync(path.join(orig_pkgDir, f), 'utf-8').match(/extends\s+CordovaActivity/);
      });

	  // Picks the first file found as the main CordovaActivity
      if (java_files.length === 0) {
        throw new Error('No Java files found which extend CordovaActivity.');
      } else if(java_files.length > 1) {
        events.emit('log', 'Multiple candidate Java files (.java files which extend CordovaActivity) found. Guessing at the first one, ' + java_files[0]);
      }

      var orig_java_class = java_files[0];

	  // Renames the main CordovaActivity
      fs.rename(path.join(orig_pkgDir, orig_java_class), orig_pkgDir + path.sep + 'MainActivity.original', function(err) {
        if ( err ) console.log(err);

        var activityPath = projectRoot + '/plugins/cordova-plugin-mfp/src/android/CordovaApp.java';
        var gcmIntentPath = projectRoot + '/plugins/cordova-plugin-mfp/src/android/GCMIntentService.java';
        var foregroundPath = projectRoot + '/plugins/cordova-plugin-mfp/src/android/ForegroundService.java';

        // Copy MFP src files to Android src package directory
        shell.cp('-f', activityPath, orig_pkgDir);
        shell.cp('-f', gcmIntentPath, orig_pkgDir);
        shell.cp('-f', foregroundPath, orig_pkgDir);


        // Replace package name in WL version of CordovaApp.java and other src files
        shell.sed('-i', 'package ${packageName}', 'package ' + orig_pkg, orig_pkgDir + path.sep + 'CordovaApp.java');
        shell.sed('-i', 'package ${packageName}', 'package ' + orig_pkg, orig_pkgDir + path.sep + 'GCMIntentService.java');
        shell.sed('-i', 'package ${packageName}', 'package ' + orig_pkg, orig_pkgDir + path.sep + 'ForegroundService.java');

        console.log(externalizedStrings.manuallyMergeMainAct);
      });

        // Removing conflicts in strings.xml
        removeConflictXml(platformPath);
    }
    else if (platformId === 'ios') {
        // iOS-specific: update main() to use WLMyAppDelegate
        var cdvProjName = fs.readdirSync(platformPath).filter(function(e) { return e.match(/\.xcodeproj$/i); })[0];
        cdvProjName = cdvProjName.substring(0, cdvProjName.indexOf('.xcodeproj'));
        var wlMainFile = path.join(pluginDir, 'src', 'ios', 'main.m');
        var cdvMainFile = path.join(platformPath, cdvProjName, 'main.m');
        var cdvMainFileBackup = cdvMainFile + '.bak';
        if (!shell.test('-f', cdvMainFileBackup)){
            //make a backup of original main.m before replacing with Worklight's version
            copyFile(cdvMainFile, cdvMainFileBackup);
        }
        copyFile(wlMainFile, cdvMainFile);

        console.log(externalizedStrings.manuallyMergeMainM);

        //Copy .wldata and buildtime.sh to project root
        var srcFile = path.join(pluginDir, 'src', 'ios', '.wldata');
        if (fs.existsSync(srcFile)) {
            copyFile(srcFile, platformPath);
        }
        srcFile = path.join(pluginDir, 'src', 'ios', 'buildtime.sh');
        if (fs.existsSync(srcFile)) {
            copyFile(srcFile, platformPath);
        }
    }
  });
}

function copyFile(wlFile, cdvFile) {
  shell.mkdir('-p', path.dirname(cdvFile));
  // dest file may already exist as read-only
  if (shell.test('-f', cdvFile)) {
    shell.chmod('u+w', cdvFile);
  }
  shell.cp('-f', wlFile, cdvFile);
}


//Removes the app_name string from the provided mfp-strings.xml files.
function removeConflictXml(platformPath) {

	// Gets source strings.xml
	var srcString = fs.readFileSync(path.join(platformPath, 'res/values/mfp-strings.xml')).toString();
    var srcTree = et.parse(srcString);
    var srcXmls = srcTree.getroot().getchildren();

    var names = ['app_name', 'launcher_name', 'activity_name'];
    // Remove the string elements with names from the array.
    for (var i = 0; i < names.length; i++) {
        srcXmls.forEach(function(srcXml) {
            if (srcXml.get('name') == names[i]) {
                srcTree.getroot().remove(srcXml);
                return;
            }
        });
    }

    // Write to destination strings.xml
    var strXml = srcTree.write({method:'xml', xml_declaration:true, indent:4});
    fs.writeFileSync(path.join(platformPath, 'res/values/mfp-strings.xml'), strXml);
}
