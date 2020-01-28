/* eslint-disable no-undef */

/* 
* @author Brett Kelley
* @info My personal Geotab library containing useful frontend javascript helper methods 
*/

var call = geotab.api.post;

/**
 *  authenticate a geotab user
 *  @param {String} server - the host name (ex. 'my.geotab.com')
 *  @param {String} userName - the Geotab username
 *  @param {String} password - the password
 *  @param {String} database - the database
 *  @return {Object} - a LoginResult which are the results of an authentication attempt.
 * credentials	object - The Credentials to be used when making calls to MyGeotab.
 * path string - The path of server hosting the database. "ThisServer" if successfully logged in to this server, or
 * "servername". The caller must handle prepending the protocol.
 */
var authenticate = function(server, userName, password, database) {
    return call(server, "Authenticate", {
        "userName": userName,
        "password": password,
        "database": database
    });
};

