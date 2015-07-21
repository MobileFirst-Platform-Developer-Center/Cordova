// Licensed Materials - Property of IBM
// 5725-I43 (C) Copyright IBM Corp. 2015. All Rights Reserved.
// US Government Users Restricted Rights - Use, duplication or
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp.

'use strict';

var strings = require('strings');
var path = require('path');

module.exports = strings({locales: path.join(__dirname, 'nls')});
