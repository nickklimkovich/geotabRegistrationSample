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

/**
 * processes the array synchronously handling duplicates
 * @author Brett Kelley
 * @param server {string} - the create database parameters
 * @param requests {array} - an array of api calls
 * @param credentials {object} - credentials object
 * @returns {array} - undefined
 */
processApiArray = function(server, requests, credentials){
    requests.reduce( async (previousPromise, request) => {
        await previousPromise;
        return executeSingleApiCallP(request, server, credentials);
      }, Promise.resolve());
};

executeSingleApiCallP = function(request, server, credentials){
    return new Promise( function (resolve, reject) {
        var method = request[0];
        console.log(method);
        var data = request[1];
        data.credentials = credentials;
        console.log(data);
        console.log(request);
        call(server, method, data)
        .then(function(result){
            var success = `Added user ${data.entity.name}`;
            console.log(success);
            resolve(success);
        }, function(err){
            var failure = `Error adding user ${data.entity.name}. Error message: ${err.message}`;
            console.log(failure);
            resolve(failure);
        });
    });
};

/**
 * import users synchronously handling duplicates
 * @author Brett Kelley
 * @param server {string} - the create database parameters
 * @param requests {array} - an array of api calls
 * @param credentials {object} - credentials object
 * @returns {object} - the database, user and password
 */
processUserImports = function(server, requests, credentials){
    return new Promise( function(resolve, reject) {
        var method;
        var data;
        for (let i = 0; i < requests.length; i++) {
            method = requests[i][0];
            console.log(method);
            data = requests[i][1];
            data.credentials = credentials;
            console.log(data);
            call(server, method, data)
            .then(function(result){
                console.log(`Added user ${data.entity.name}`);
            }, function(err){
                console.log(`Error adding user ${data.entity.name}. Error: ${err.message}`);
            });
        }
        resolve(requests);
    });
};