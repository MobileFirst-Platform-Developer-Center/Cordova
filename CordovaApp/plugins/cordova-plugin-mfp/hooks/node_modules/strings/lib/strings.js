// Licensed Materials - Property of IBM
// 5725-I43 (C) Copyright IBM Corp. 2014. All Rights Reserved.
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';
var fs = require('fs');
var nopt = require('nopt');
var path = require('path');

var colors = require('colors');

var theme = {
	error: 'red',
	errorMessage: 'magenta',
	warn: 'yellow',
	success: 'green',
	info: 'cyan'
};

colors.setTheme(theme);

function log(message, level) {
	if (message) {
		if (level && message[level]) {
			message = message[level];
		}
		console.log(message);
	}
}

/* Load locales specified through arguments (--nl [locale]) or the LANG environment variable. If no locale is specified,
 * the default messages.json is used. The default will also be used if any strings of a given locale have not been translated.
 *
 * config.locales: the directory of translated JSON files
 */
module.exports = function (config) {

	// No locales directory was specified, or the locales directory doesn't exist
	if (typeof config.locales !== 'string' || !fs.existsSync(config.locales)) {
		return {};
	}

	var locales = config.locales;
	var defaultTranslation = path.join(locales, 'messages.json');

	// Check that the default translation exists
	if (!fs.existsSync(defaultTranslation)) {
		return {};
	}

	// The locale can be specified by the command line or an environment variable
	var opts = nopt({
		nl: String
	}, process.argv, 0);
	var locale = opts.nl || (process.env.LANG ? process.env.LANG.replace(/\..*$/, '') : null);

	if (locale) locales = path.join(locales, locale);

	var strings = require(defaultTranslation) || {};

	//If the specified locale exists, replace the default strings with those from the locale
	if (fs.existsSync(path.join(locales, 'messages.json'))) {
		// Read the locale's strings
		var localeStrings = require(path.join(locales, 'messages.json'));
		for (var key in strings) {
			strings[key] = localeStrings[key] || strings[key];
		}
	}

	return strings;

};

module.exports.theme = theme;

/*
 * A little more aggressive error display. Specifies that it is an error,
 * and logs the message to standard error using theme.errorMessage
 */
module.exports.fatal = function (message) {
	if (message) {
		console.error('Error: '.error + message.errorMessage);
	}
};

/*
 * Logs an error message to standard error using theme.error
 */
module.exports.error = function (message) {
	if (message) {
		console.error(message.error);
	}
};

/*
 * Logs a message using theme.success
 */
module.exports.success = function (message) {
	log(message, theme.success);
};

/*
 * Logs a message using theme.info
 */
module.exports.info = function (message) {
	log(message, theme.info);
};

/*
 * Logs a message using theme.warn
 */
module.exports.warn = function (message) {
	log(message, theme.warn);
};

/*
 * Logs a message to the standard output. If a level is supplied,
 * that theme item will be used
 */
module.exports.log = function (message, level) {
	log(message, level);
};

/*
 * Binds a series of arguments to the placeholders in the string. The first argument
 * is the string containing placeholders, and subsequent arguments will replace the
 * placeholders.
 */
module.exports.format = function () {
	var replacedString = Array.prototype.slice.call(arguments, 0)[0];

	for (var i = 0; i < arguments.length; i++) {
		replacedString = replacedString.replace(new RegExp('(\\{' + i + '\\})', 'g'), arguments[i + 1]);
	}
	return replacedString;
};
