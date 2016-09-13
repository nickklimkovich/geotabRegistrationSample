// jshint devel:true
document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    var CONFIG = {
            // This is the host will post to to create the database. This should be the root server in the federation.
            host: "my.geotab.com",
            debug: true,
            // Local debug config (you must create DB and admin user manually)
            debugDBConfig: {
                host: "localhost",
                db: "temp", // loacal DB name
                user: "nickklimkovich@geotab.com", // DB admin user
                password: "qweqwe" // DB admin user password
            },
            allowedSecurityRules: [ // If not empty array then Restricted Admin user will be created with permission provided
                //"AboutCheckmate",
                //"DeviceAdmin",
                //"DeviceAdminAdvanced",
                //"DeviceList",
                //"DisplayMap",
                //"NotificationList",
                //"TripsActivityReport",
                //"UserSettings"
            ]
        },

        // local - helps create local options based on selected time zone. See app/scripts/local.js.
        local = geotab.local,
        // call - helps make calls to MyGeotab API
        call = geotab.api.post,
        multiCall = geotab.api.multiCall,

        // DOM Elements
        elError = document.querySelector("#error"),
        elErrorContent = document.querySelector("#error > span"),
        elErrorClose = document.querySelector("#error-close"),
        elLoading = document.querySelector("#loading"),
        elWaiting = document.querySelector("#waiting"),

        elCompanyName = document.querySelector("#companyName"),
        elDatabaseName = document.querySelector("#databaseName"),
        elPhoneNumber = document.querySelector("#phoneNumber"),
        elFleetSize = document.querySelector("#fleetSize"),
        elTimeZone = document.querySelector("#timeZone"),

        elFirstName = document.querySelector("#firstName"),
        elLastName = document.querySelector("#lastName"),
        elEmail = document.querySelector("#email"),
        elPassword = document.querySelector("#password"),
        elConfirmPassword = document.querySelector("#confirmPassword"),
        elUpdates = document.querySelector("#updates"),
        elCaptchaImage = document.querySelector("#captchaImage"),
        elCaptchaAnswer = document.querySelector("#captchaAnswer"),
        elImportFile = document.querySelector("#importFile"),

        elSubmit = document.querySelector("#submit"),

        elRequiredInputs = document.querySelectorAll("input[required]"),

        defaultGroupId = "GroupCompanyId",
        defaultPrivateGroupId = "GroupPrivateUserId",

        // Dom helpers
        /**
         * Validation states
         * @type {{none: string, success: string, warning: string, error: string}}
         */
        validationState = {
            none: "",
            success: "has-success",
            warning: "has-warning",
            error: "has-error"
        },

        importedConfigFile,

        extend = function() {
            var args = arguments,
                length = args.length,
                src, srcKeys, srcAttr,
                fullCopy = false,
                resAttr,
                res = args[0], i = 1, j,
                isUsualObject = function (obj) {
                    return Object.prototype.toString.call(obj).indexOf("Object") !== -1;
                };

            if (typeof res === "boolean") {
                fullCopy = res;
                res = args[1];
                i++;
            }
            while (i !== length) {
                src = args[i];
                srcKeys = Object.keys(src);
                for (j = 0; j < srcKeys.length; j++) {
                    srcAttr = src[srcKeys[j]];
                    if (fullCopy && (isUsualObject(srcAttr) || Array.isArray(srcAttr))) {
                        resAttr = res[srcKeys[j]];
                        resAttr = res[srcKeys[j]] = (isUsualObject(resAttr) || Array.isArray(resAttr)) ? resAttr : (Array.isArray(srcAttr) ? [] : {});
                        extend(fullCopy, resAttr, srcAttr);
                    } else {
                        res[srcKeys[j]] = src[srcKeys[j]];
                    }
                }
                i++;
            }
            return res;
        },

        /**
         * Change the validation state of a for input
         * @param el - The element
         * @param state - The validation state
         */
        changeValidationState = function (el, state) {
            Object.keys(validationState).forEach(function (key) {
                if (validationState[key]) {
                    el.classList.remove(validationState[key]);
                }
            });
            if (state) {
                el.classList.add(state);
            }
        },

        // Loading
        /**
         * Show loading spinner (locks UI)
         */
        showLoading = function () {
            elLoading.style.display = "block";
        },

        /**
         * Hide loading spinner
         */
        hideLoading = function () {
            elLoading.style.display = "none";
        },

        // Errors
        /**
         * Show error message
         * @param err - The error object
         */
        showError = function (err) {
            var errorString = "Error";
            if (err && (err.name || err.message)) {
                errorString = (err.name ? err.name + ": " : +"") + (err.message || "");
            }
            elErrorContent.textContent = errorString;
            elError.style.display = "block";
        },

        /**
         * Hide error message
         */
        hideError = function () {
            elError.style.display = "none";
        },

        /**
         * Create a short database name from a company name
         * @param companyName {string} - the name of the company
         * @returns {string} - the short database name
         */
        createDatabaseNameFromCompany = function (companyName) {
            var underscore_char = 95,
                companyNameCharacters = new Array(companyName.length),
                i = 0,
                num, num1, num2, c,
                chrArray = companyName.split("").map(function (c) {
                    return c.charCodeAt(0);
                }),
                length = chrArray.length;

            for (num = 0; num < length; num++) {
                c = chrArray[num];
                if ((/\w|\d/.test(String.fromCharCode(c)) ? 1 : 0) !== 0) {
                    num1 = i;
                    i++;
                    companyNameCharacters[num1] = c;
                } else if (i > 0 && companyNameCharacters[i - 1] !== underscore_char) {
                    num2 = i;
                    i++;
                    companyNameCharacters[num2] = underscore_char;
                }
            }

            if (i > 0 && companyNameCharacters[i - 1] === underscore_char) {
                i = i + -1;
            }

            return String.fromCharCode.apply(String.fromCharCode, companyNameCharacters).substr(0, i);
        },

        // So we can clear the timeout if user is still typing
        checkAvailabilityTimeout,

        /**
         * Check to see if the database name exists
         * @param databaseName {string} - the database name
         */
        checkAvailability = function (databaseName) {
            elDatabaseName.parentNode.querySelector(".help-block").style.display = "none";
            changeValidationState(elDatabaseName.parentNode, validationState.none);
            if (!databaseName) {
                elWaiting.style.display = "none";
                return;
            }
            elWaiting.style.display = "block";
            if (checkAvailabilityTimeout) {
                clearTimeout(checkAvailabilityTimeout);
            }
            checkAvailabilityTimeout = setTimeout(function () {
                call(CONFIG.host, "DatabaseExists", {
                    database: databaseName
                })
                    .then(function (result) {
                        changeValidationState(elDatabaseName.parentNode, result ? validationState.error : validationState.success);
                        elDatabaseName.parentNode.querySelector(".help-block").style.display = result ? "block" : "none";
                        elWaiting.style.display = "none";
                    }, function (err) {
                        elWaiting.style.display = "none";
                        showError(err);
                    });
            }, 600);
        },

        /**
         * Update the displayed short database name and check if it's availability
         * @param companyName
         */
        updateShortDatabase = function (companyName) {
            var databaseName = createDatabaseNameFromCompany(companyName);
            elDatabaseName.value = databaseName;
            checkAvailability(databaseName);
        },

        // Setup
        /**
         * Get a list of IANA time zones form the server and add to time zone select input
         */
        renderTimeZones = function () {
            call(CONFIG.host, "GetTimeZones")
                .then(function (timeZones) {
                    elTimeZone.innerHTML = timeZones
                        .sort(function (a, b) {
                            var textA = a.id.toLowerCase();
                            var textB = b.id.toLowerCase();
                            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
                        }).map(function (timeZone) {
                            return "<option value=\"" + timeZone.id + "\">" + timeZone.id + "</option>";
                        });
                }, showError);
        },

        // store the captcha id in scope so we can use it when we create the database
        captchaId,

        /**
         * Render a new CAPTCHA image with a random captcha id (uuid)
         */
        renderCaptcha = function () {
            captchaId = uuid.v4();
            elCaptchaImage.setAttribute("src", "https://" + CONFIG.host + "/apiv1/GenerateCaptcha?id=" + captchaId);
            elCaptchaAnswer.value = "";
        },

        /**
         * Get the form values from the DOM
         * @returns {{captchaAnswer: {id: *, answer: *}, databaseName: *, userName: *, password: *, companyDetails: {companyName: *, firstName: *, lastName: *, phoneNumber: *, resellerName: string, fleetSize: (Number|number), comments: string, signUpForNews: *}}}
         */
        getFormValues = function () {
            return {
                captchaAnswer: {
                    id: captchaId,
                    answer: elCaptchaAnswer.value
                },
                database: elDatabaseName.value,
                userName: elEmail.value,
                password: elPassword.value,
                companyDetails: {
                    companyName: elCompanyName.value,
                    firstName: elFirstName.value,
                    lastName: elLastName.value,
                    phoneNumber: elPhoneNumber.value,
                    resellerName: "ABC Fleets",
                    fleetSize: parseInt(elFleetSize.value, 10) || 0,
                    comments: "",
                    signUpForNews: elUpdates.checked
                }
            };
        },

        // Validation
        /**
         * Validate an email address
         * @param email {string} - the email address
         * @returns {boolean} - is the email address vailid
         */
        isValidEmail = function (email) {
            var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
            return re.test(email);
        },

        validatePasswordTimeout,
        /**
         * Validate the entered password
         */
        validatePassword = function () {
            if (validatePasswordTimeout) {
                clearTimeout(validatePasswordTimeout);
            }
            validatePasswordTimeout = setTimeout(function () {
                var isValid = elPassword.value === elConfirmPassword.value;
                var elParent = elConfirmPassword.parentNode;
                changeValidationState(elParent, isValid ? validationState.success : validationState.error);
                elParent.querySelector(".help-block").style.display = isValid ? "none" : "block";
            }, 600);
        },

        /**
         * Validate form values
         * @param values {object} - the for values as retrieved by getFormValues
         * @returns {boolean}
         */
        isFormValid = function (values) {
            var isValid = true;
            if (!values.companyDetails.companyName) {
                isValid = false;
                changeValidationState(elCompanyName.parentNode, validationState.error);
            }
            if (!values.database) {
                isValid = false;
                changeValidationState(elDatabaseName.parentNode, validationState.error);
            }
            if (!values.userName || !isValidEmail(values.userName)) {
                isValid = false;
                changeValidationState(elEmail.parentNode, validationState.error);
            }
            if (!values.companyDetails.firstName) {
                isValid = false;
                changeValidationState(elFirstName.parentNode, validationState.error);
            }
            if (!values.companyDetails.lastName) {
                isValid = false;
                changeValidationState(elLastName.parentNode, validationState.error);
            }
            if (!values.password) {
                isValid = false;
                changeValidationState(elPassword.parentNode, validationState.error);
            }
            if (!values.captchaAnswer.answer) {
                isValid = false;
                changeValidationState(elCaptchaAnswer.parentNode, validationState.error);
            }
            return isValid;
        },

        // Registration process
        /**
         * Create a database in the federation
         * @param params {object} - the create database parameters
         * @returns {object} - the database, user and password
         */
        createDatabase = function (params) {
            if (CONFIG.debug) {
                return createDebugDatabase(params);
            }
            var processResult = function (results) {
                var parts = results.split("/");

                return {
                    server: parts[0],
                    database: parts[1],
                    userName: params.userName,
                    password: params.password
                };
            };
            return call(CONFIG.host, "CreateDatabase", params).then(processResult);
        },


        createDebugDatabase = function () {
            var processResult = function () {
                return {
                    server: CONFIG.debugDBConfig.host,
                    database: CONFIG.debugDBConfig.db,
                    userName: CONFIG.debugDBConfig.user,
                    password: CONFIG.debugDBConfig.password
                };
            };
            return new Promise(function (resolve, reject) {
                if (CONFIG.debugDBConfig) {
                    resolve(processResult());
                } else {
                    reject("There is no DEBUG_CONFIG");
                }
            });
        },

        /**
         * Authenticate the user against the new database
         * @param options {object}
         * @returns {object} - options with credentials
         */
        authenticate = function (options) {
            return call(options.server, "Authenticate", {
                userName: options.userName,
                password: options.password,
                database: options.database
            }).then(function (results) {
                return {
                    server: options.server,
                    credentials: results.credentials
                };
            });
        },

        /**
         * Get the administrator user from the new database
         * @param options {object}
         * @returns {object} - options with user
         */
        getUser = function (options) {
            return call(options.server, "Get", {
                credentials: options.credentials,
                typeName: "User",
                search: {
                    name: options.credentials.userName
                }
            }).then(function (results) {
                options.user = results[0];
                return options;
            });
        },

        /**
         *  Create clearance
         * @param options {object}
         * @returns {object} - options
         */
        createClearance = function (options) {
            var user = options.user;

            if (!CONFIG.allowedSecurityRules.length) {
                return new Promise(function (resolve) {
                    return resolve(options);
                });
            }

            return call(options.server, "Add", {
                credentials: options.credentials,
                typeName: "Group",
                entity: {
                    id: null,
                    parent: {id: "GroupNothingSecurityId"},
                    name: "Restricted Admin",
                    securityFilters: CONFIG.allowedSecurityRules.map(function (permission) {
                        return {
                            isAdd: true,
                            securityIdentifier: permission
                        }
                    }),
                    color: {a: 0, b: 0, g: 0, r: 0}
                }
            }).then(function (clearenceId) {
                // pass on the options to the next promise
                user.securityGroups = [{
                    id: clearenceId,
                    color: {"r": 0, "g": 0, "b": 0, "a": 255}
                }];
                return options;
            });
        },

        /**
         *  Set up the administrator with localized settings based on the selected time zone
         * @param options {object}
         * @returns {object} - options
         */
        setUserDefaults = function (options) {
            var timeZone = elTimeZone.value,
                continent = local.getContinentByTimeZone(timeZone),
                user = options.user;

            user.timeZoneId = timeZone;
            user.isMetric = local.getIsMetricByTimeZone(timeZone);
            user.fuelEconomyUnit = local.getFuelEconomyUnitByTimeZone(timeZone);
            user.dateFormat = local.getDateTimeFormatByTimeZone(timeZone);
            user.mapViews = local.getMapViewsByTimeZone(continent);
            user.firstName = elFirstName.value;
            user.lastName = elLastName.value;
            // Could also set the user's language here (en,fr,es,de,ja): user.language = 'en';

            return call(options.server, "Set", {
                credentials: options.credentials,
                typeName: "User",
                entity: user
            }).then(function () {
                // pass on the options to the next promise
                return options;
            });
        },

        /**
         * Upload config file
         * @param options {object}
         * @returns {object} - options
         */
        uploadConfigFile = function (options) {

            return new Promise(function (resolve, reject) {
                var fileReader = new FileReader(),
                    errorHandler = function (evt) {
                        reject(evt.target.error);
                    };

                if (!importedConfigFile) {
                    return resolve(options);
                }

                fileReader.onerror = errorHandler;
                fileReader.onabort = function() {
                    throw new Error("File read cancelled");
                };
                fileReader.onload = function(e) {
                    var contentString = e.target.result,
                        content;
                    try {
                        content = JSON.parse(contentString);
                    } catch(e) {
                        reject(e);
                    }

                    options.importedConfig = content;
                    resolve(options)
                };

                fileReader.readAsText(importedConfigFile);
            });
        },

        /**
         *  Import config
         * @param options {object}
         * @returns {object} - options
         */
        importConfig = function (options) {
            var config = options.importedConfig,
                importSequence = [
                    {types: ["groups"], importer: importGroups},
                    {types: ["securityGroups"], importer: importSecurityGroups},
                    {types: ["workHolidays", "workTimes", "zoneTypes", "users"], importer: importGroupsOfEntities},
                    {types: ["zones", "devices"], importer: importGroupsOfEntities},
                    {types: ["rules"], importer: importRules},
                    {types: ["reports"], importer: importReports},
                    {types: ["misc"], importer: importMiscSettings}
                ];
            return new Promise(function (resolve) {
                if(!config) {
                    return resolve(options);
                }

                importSequence.reduce(function(result, levelImportParams) {
                    var dataForImport = levelImportParams.types.map(function(entityType) {
                            return {type: entityType, data: config[entityType]};
                        });

                    return result.then(function() {
                        return levelImportParams.importer(options, dataForImport);
                    })
                }, new Promise(function(resolve) { resolve(); })).then(function () {
                    return call(options.server, "Set", {
                        credentials: options.credentials,
                        typeName: "User",
                        entity: options.user
                    });
                }).then(function(){
                    resolve(options);
                });
            });
        },

        importGroups = function (options, groupsData) {
            var groups = groupsData[0].data,
                splitGroupsByLevels = function () {
                    var processedIds = [defaultGroupId],
                        levelItems,
                        levelIds,
                        levels = [],
                        parentIds = [defaultGroupId, defaultPrivateGroupId];
                    do {
                        levelItems = findItemsWithParents(parentIds);
                        levelIds = levelItems.map(function (item) {return item.id});
                        levels.push(levelItems);
                        processedIds = processedIds.concat(levelIds);
                        parentIds = levelIds;
                    } while (parentIds.length > 0);
                    return levels;
                },
                findItemsWithParents = function (oldParentIds) {
                    return groups.reduce(function (items, group) {
                        group.parent && oldParentIds.indexOf(group.parent.id) > -1 && items.push(group);
                        return items;
                    }, []);
                },
                generateAddGroupRequest = function (group) {
                    var oldId = group.id,
                        oldParentId = group.parent && group.parent.id,
                        newId = options.importedData.groups[oldId],
                        newParentId = oldParentId && options.importedData.groups[oldParentId],
                        request,
                        newGroup;
                    if(group.name && !newId && newParentId) {
                        newGroup = extend(true, {}, group);
                        newGroup.id = null;
                        newGroup.children = [];
                        newGroup.parent = { id: newParentId };
                        if (newParentId === defaultPrivateGroupId) {
                            newGroup = {
                                name: options.user.name,
                                color: {r: 0, g: 0, b: 0, a: 0},
                                parent: {
                                    id: defaultPrivateGroupId
                                }
                            };
                        }
                        request = ["Add", {
                            typeName: "Group",
                            entity: newGroup
                        }];
                    }
                    return request;
                },
                parseResults = function (levelGroups, results) {
                    results.forEach(function (result, index) {
                        result && (options.importedData.groups[levelGroups[index].id] = result);
                        levelGroups[index].parent.id === defaultPrivateGroupId && options.user.privateUserGroups.push({id: result});
                    })
                },
                groupsLevels = splitGroupsByLevels(groups);

            options.importedData = {};
            options.importedData.groups = {};
            options.importedData.groups[defaultGroupId] = defaultGroupId;
            options.importedData.groups[defaultPrivateGroupId] = defaultPrivateGroupId;
            return groupsLevels.reduce(function (addPromise, levelGroups, index) {
                return addPromise.then(function () {
                    var requests;
                    requests = levelGroups.reduce(function (requests, levelGroup) {
                        var addRequest = generateAddGroupRequest(levelGroup);
                        addRequest && requests.push(addRequest);
                        return requests;
                    }, []);
                    if (requests.length) {
                        return multiCall(options.server, requests, options.credentials);
                    } else {
                        return [];
                    }
                }).then(function(previousResult){
                    parseResults(groupsLevels[index], previousResult);
                }).then(function(){
                    return options;
                });
            }, new Promise(function(fakeResolver){ return fakeResolver([]); }));
        },

        updateGroupsIds = function (object, properties, groupsHash) {
            Object.keys(object).forEach(function (property) {
                var value = object[property];
                if (properties.indexOf(property) > -1 && Array.isArray(value)) {
                    value.forEach(function (item) {
                        item.id = groupsHash[item.id];
                        delete item.children;
                    })
                }
            })
        },

        updateZoneTypesIds = function (object, zoneTypesHash) {
            object.zoneTypes.forEach(function (item) {
                item.id && (item.id = zoneTypesHash[item.id]);
            })
        },

        importSecurityGroups = function (options, groupsData) {
            var groups = groupsData[0].data,
                splitGroupsByLevels = function () {
                    var processedIds = [defaultGroupId],
                        levelItems,
                        levelIds,
                        levels = [],
                        parentIds;
                    do {
                        levelItems = findItemsWithParents(parentIds);
                        levelIds = levelItems.map(function (item) {return item.id});
                        levels.push(levelItems);
                        processedIds = processedIds.concat(levelIds);
                        parentIds = levelIds;
                    } while (parentIds.length > 0);
                    return levels;
                },
                findItemsWithParents = function (oldParentIds) {
                    return groups.reduce(function (items, group) {
                        if(!oldParentIds) {
                            group.parent && group.parent.id.indexOf("Group") > -1 && items.push(group);
                        } else {
                            group.parent && oldParentIds.indexOf(group.parent.id) > -1 && items.push(group);
                        }
                        return items;
                    }, []);
                },
                generateAddGroupRequest = function (group) {
                    var oldId = group.id,
                        oldParentId = group.parent && group.parent.id,
                        newId = options.importedData.securityGroups[oldId],
                        newParentId = oldParentId && (options.importedData.securityGroups[oldParentId] || oldParentId),
                        request,
                        newGroup;
                    if(group.name && !newId && newParentId) {
                        newGroup = extend(true, {}, group);
                        newGroup.id = null;
                        newGroup.children = [];
                        newGroup.parent = { id: newParentId };
                        request = ["Add", {
                            typeName: "Group",
                            entity: newGroup
                        }];
                    }
                    return request;
                },
                parseResults = function (levelGroups, results) {
                    results.forEach(function (result, index) {
                        result && (options.importedData.securityGroups[levelGroups[index].id] = result);
                    })
                },
                groupsLevels = splitGroupsByLevels(groups);

            options.importedData.securityGroups = {};
            return groupsLevels.reduce(function (addPromise, levelGroups, index) {
                return addPromise.then(function () {
                    var requests;
                    requests = levelGroups.reduce(function (requests, levelGroup) {
                        var addRequest = generateAddGroupRequest(levelGroup);
                        addRequest && requests.push(addRequest);
                        return requests;
                    }, []);
                    if (requests.length) {
                        return multiCall(options.server, requests, options.credentials);
                    } else {
                        return [];
                    }
                }).then(function(previousResult){
                    parseResults(groupsLevels[index], previousResult);
                }).then(function(){
                    return options;
                });
            }, new Promise(function(fakeResolver){ return fakeResolver([]); }));
        },

        importGroupsOfEntities = function (options, entitiesData) {
            var initialData = [],
                requests = entitiesData.reduce(function(requests, entityData) {
                    var type = entityData.type,
                        data = entityData.data;
                    initialData = initialData.concat(data);
                    return requests.concat(generateAddRequests(options, data, type))
                }, []);
            return multiCall(options.server, requests, options.credentials).then(function(importedData) {
                updateImportedData(options, requests, initialData, importedData);
                return options;
            });
        },

        generateAddRequests = function (options, entities, entityType) {
            return entities.reduce(function (requests, entity) {
                var method = "Add",
                    entityCopy = extend(true, {}, entity),
                    requestTypeName;
                switch(entityType) {
                    case "users":
                        requestTypeName = "User";
                        if(entityCopy.name !== options.user.name) {
                            entityCopy.password = "1111111";
                            entityCopy.changePassword = "true";
                        } else {
                            method = "Set";
                            entityCopy = options.user;
                        }
                        updateGroupsIds(entityCopy, ["companyGroups", "driverGroups"], options.importedData.groups);
                        updateGroupsIds(entityCopy, ["securityGroups"], options.importedData.securityGroups);
                        break;
                    case "devices":
                        requestTypeName = "Device";
                        updateGroupsIds(entityCopy, ["groups", "autoGroups"], options.importedData.groups);
                        entityCopy.workTime.id && (entityCopy.workTime.id = options.importedData.WorkTime[entityCopy.workTime.id]);
                        break;
                    case "zones":
                        requestTypeName = "Zone";
                        updateZoneTypesIds(entityCopy, options.importedData.ZoneType);
                        updateGroupsIds(entityCopy, ["groups"], options.importedData.groups);
                        break;
                    case "zoneTypes":
                        requestTypeName = "ZoneType";
                        break;
                    case "workTimes":
                        requestTypeName = "WorkTime";
                        !entityCopy.name && (method = "Set");
                        entityCopy.details && entityCopy.details.forEach(function(detail) {detail.id && delete(detail.id)});
                        break;
                    case "workHolidays":
                        requestTypeName = "WorkHoliday";
                        break;
                }
                method === "Add" && delete(entityCopy.id);
                requests.push([method, {
                    typeName: requestTypeName,
                    entity: entityCopy
                }]);
                return requests;
            }, []);
        },

        importRules = function (options, rulesData) {
            var rules = rulesData[0].data,
                updateDependencies = function (rules) {
                    var updateConditionsData = function(condition) {
                            delete(condition.id);
                            delete(condition.sequence);
                            switch (condition.conditionType) {
                                case "RuleWorkHours":
                                    condition.workTime && condition.workTime.id && (condition.workTime.id = options.importedData.WorkTime[condition.workTime.id]);
                                    break;
                                case "Driver":
                                    condition.driver && condition.driver.id && (condition.driver.id = options.importedData.User[condition.driver.id]);
                                    break;
                                case "Device":
                                    condition.device && condition.device.id && (condition.device.id = options.importedData.Device[condition.device.id]);
                                    break;
                                case "EnteringArea":
                                    condition.zone ? (condition.zone.id && options.importedData.Zone[condition.zone.id] && (condition.zone.id = options.importedData.Zone[condition.zone.id])) :
                                        (condition.zoneType.id && options.importedData.ZoneType[condition.zoneType.id] && (condition.zoneType.id = options.importedData.ZoneType[condition.zoneType.id]));
                                    break;
                            }
                        },
                        checkConditions = function (parentCondition) {
                            var children = parentCondition.children || [];
                            updateConditionsData(parentCondition);
                            children.forEach(function (condition) {
                                if (condition.children) {
                                    checkConditions(condition);
                                } else {
                                    updateConditionsData(condition);
                                }
                            });
                        };
                    rules.forEach(function (rule) {
                        updateGroupsIds(rule, "groups", options.importedData.groups);
                        checkConditions(rule.condition);
                    });
                },
                getStockRuleParams = function(rule) {
                    var parseDurationInMinutes = function() {
                            if (!rule.condition || !rule.condition.conditionType || rule.condition.conditionType !== "DurationLongerThan") {
                                if (rule && rule.condition && rule.condition.conditionType === "And") {
                                    for (var idx in rule.condition.children) {
                                        var child = rule.condition.children[idx];
                                        if (child.conditionType === "DurationLongerThan") {
                                            return parseFloat(child.value / 60);
                                        }
                                    }
                                }
                                return 20;
                            }
                            return parseFloat(rule.condition.value / 60);
                        },
                        parseMaxValue = function() {
                            if (!rule.condition || !rule.condition.conditionType || rule.condition.conditionType !== "IsValueLessThan") {
                                return null;
                            }
                            return parseFloat(rule.condition.value);
                        },
                        parseMinValue = function() {
                            if (!rule.condition || !rule.condition.conditionType || rule.condition.conditionType !== "IsValueMoreThan") {
                                return null;
                            }
                            return parseFloat(rule.condition.value);
                        },
                        parseMinValueOfChildRule = function() {
                            if (!rule.condition || !rule.condition.children.length|| !rule.condition.children[0].conditionType || rule.condition.children[0].conditionType !== "IsValueMoreThan") {
                                return null;
                            }
                            return parseFloat(rule.condition.children[0].value);
                        },
                        parseReverseAtTripStartDistanceValue = function() {
                            if (!rule.condition || rule.condition.conditionType !== "DistanceLongerThan" || !rule.condition.children) {
                                return null;
                            }
                            var children = rule.condition.children;
                            if (!children[0] || children[0].conditionType !== "And" || !children[0].children) {
                                return null;
                            }
                            for (var i = 0; i < children[0].children.length; i++) {
                                var c = children[0].children[i];
                                if (c.children && c.children[0] && c.children[0].conditionType === "TripDistance") {
                                    return parseFloat(c.value);
                                }
                            }
                            return null;
                        },
                        parseFleetIdlingZone = function() {
                            if (rule && rule.condition && rule.condition.children && rule.condition.children[0] && rule.condition.children[0].children) {
                                for (var i = 0; i < rule.condition.children[0].children.length; i++) {
                                    var condition = rule.condition.children[0].children[i];
                                    if (condition.conditionType === "InsideArea" && condition.zoneType === "ZoneTypeOfficeId") {
                                        return true;
                                    }
                                }
                            }
                            return false;
                        },
                        stockRuleType = rule.id,
                        params = [];

                    switch (stockRuleType) {
                        case "RuleHarshBrakingId":
                            params = [parseMaxValue()];
                            break;
                        case "RuleJackrabbitStartsId":
                            params = [parseMinValue()];
                            break;
                        case "RuleHarshCorneringId":
                            var value;
                            if (rule.condition && rule.condition.children && rule.condition.children[0]) {
                                value = rule.condition.children[0].value;
                            }
                            params = [value];
                            break;
                        case "RulePostedSpeedingId":
                            params = [parseMinValueOfChildRule()];
                            break;
                        case "RuleReverseAtStartId":
                            params = [parseReverseAtTripStartDistanceValue() || 20];
                            break;
                        case "RuleIdlingId":
                        case "RuleAtOfficeLongerThanId":
                        case "RuleLongLunchId":
                        case "RuleLongStopsDuringWorkHoursId":
                            params = [parseDurationInMinutes()];
                            break;
                        case "RuleFleetIdlingId":
                            params = [parseDurationInMinutes(), parseFleetIdlingZone()];
                            break;
                    }
                    return params;
                },
                customTypeGetter = function (request) {
                    return "rules";
                },
                customIdGetter = function (result) {
                    return result.id;
                },
                requests;
            updateDependencies(rules);
            requests = rules.reduce(function (requests, rule) {
                var ruleCopy;
                if(rule.baseType === "Stock") {
                    requests.push(["SetStockExceptionRule", {
                        stockRuleDefinition: {
                            id: rule.id,
                            param: getStockRuleParams(rule)
                        }
                    }]);
                } else {
                    ruleCopy = extend(true, {}, rule);
                    delete(ruleCopy.id);
                    delete(ruleCopy.version);
                    requests.push(["SetExceptionRuleWithConditions", {
                        newRule: ruleCopy,
                        oldRule: null
                    }]);
                }
                return requests;
            }, []);
            return multiCall(options.server, requests, options.credentials).then(function(importedRules) {
                updateImportedData(options, requests, rules, importedRules, customTypeGetter, customIdGetter);
                return options;
            });
        },

        updateImportedData = function(options, requests, initialData, importedData, customTypeGetter, customIdGetter) {
            requests.forEach(function (request, index) {
                var oldId = initialData[index].id,
                    newId = (customIdGetter ? customIdGetter(importedData[index]) : importedData[index]) || oldId,
                    type = customTypeGetter ? customTypeGetter(request) : request[1].typeName;
                if(!options.importedData[type]) options.importedData[type] = {};
                options.importedData[type][oldId] = newId;
            });
        },

        importReports = function (options, reportsData) {
            var reports = reportsData[0].data,
                importTemplates = function (templates) {
                    var requests = templates.reduce(function (requests, template) {
                            var templateCopy = extend(true, {}, template);
                            if (!template.isSystem) {
                                delete templateCopy.id;
                                delete templateCopy.reports;
                                requests.push(["Add", {
                                    typeName: "ReportTemplate",
                                    entity: templateCopy
                                }]);
                            } else {
                                delete templateCopy.binaryData;
                                requests.push(["Set", {
                                    typeName: "ReportTemplate",
                                    entity: templateCopy
                                }]);
                            }
                            return requests;
                        }, []);
                    return multiCall(options.server, requests, options.credentials);
                },
                getReportsForImport = function (templates, importedTemplates) {
                    return templates.reduce(function (reports, template, templateIndex) {
                        var templateReports = template.reports,
                            newTemplateId = importedTemplates[templateIndex] || template.id;
                        return templateReports.reduce(function (templateReports, report) {
                            var reportCopy = extend(true, {}, report);
                            reportCopy.template = {id: newTemplateId};
                            reportCopy.lastModifiedUser = {id: options.user.id};
                            reportCopy.id = null;
                            updateGroupsIds(reportCopy, ["groups", "includeAllChildrenGroups", "includeDirectChildrenOnlyGroups", "scopeGroups"], options.importedData.groups);
                            updateReportDevices(reportCopy);
                            updateReportRules(reportCopy);
                            templateReports.push(reportCopy);
                            return templateReports;
                        }, reports)
                    }, []);
                },
                updateReportDevices = function (report) {
                    if (!report.arguments || !report.arguments.devices) {
                        return;
                    }
                    report.arguments.devices.forEach(function(device) {
                        var id = device && device.id;
                        id && options.importedData.devices[id] && (device.id = options.importedData.devices[id]);
                    })
                },
                updateReportRules = function (report) {
                    if (!report.arguments || !report.arguments.rules) {
                        return;
                    }
                    report.arguments.rules.forEach(function(rule) {
                        var id = rule && rule.id;
                        id && options.importedData.rules[id] && (rule.id = options.importedData.rules[id]);
                    })
                },
                importReports = function (reports) {
                    var requests = reports.reduce(function (requests, report) {
                            requests.push(["Add", {
                                typeName: "CustomReportSchedule",
                                entity: report
                            }]);
                            return requests;
                        }, []);
                    return multiCall(options.server, requests, options.credentials);
                };
            options.importedData.reports = {};
            return new Promise(function (resolve, reject) {
                importTemplates(reports).then(function (importedTemplates) {
                    var reportsForImport = getReportsForImport(reports, importedTemplates);
                    return importReports(reportsForImport);
                }).then(function (importedReports) {
                    resolve(options);
                }).catch(reject);
            });
        },

        importMiscSettings = function (options, miscData) {
            miscData[0].data.reduce(function(results, miscItem) {
                switch(miscItem.name) {
                    case "mapProvider":
                        results.then(function() {
                            return setDefaultMapProvider(options, miscItem.data);
                        });
                        break;
                }
                return results;
            }, new Promise(function(resolve) { resolve(); })).then(function () {
                return options;
            });
        },

        setDefaultMapProvider = function (options, providerData) {
            var promise = new Promise(function(resolve) {
                resolve();
            });
            !providerData.isDefault && promise.then(function() {
                return call(options.server, "Get", {
                    credentials: options.credentials,
                    typeName: "SystemSettings"
                }).then(function (result) {
                    var systemSettings = result[0];
                    systemSettings.mapProvider = providerData.value;
                    // pass on the options to the next promise
                    return call(options.server, "Set", {
                        credentials: options.credentials,
                        typeName: "SystemSettings",
                        entity: systemSettings
                    });
                })
            });

            options.user.defaultMapEngine = providerData.value;
            return promise.then(function () {
                return options;
            });
        },


        /**
         * Send the administrator a success email
         * @param options {object}
         * @returns {*} - send email results (nothing)
         */
        sendSuccessEmail = function (options) {
            var credentials = options.credentials,
                user = options.user,
                welcomeMessage = "Welcome to MyGeotab, you can login to your database via this url: https://" + CONFIG.host + "/" + credentials.database;

            return call(options.server, "SendEmail", {
                credentials: credentials,
                email: user.name,
                subject: "Registration Success",
                body: welcomeMessage,
                bodyHtml: "<p>" + welcomeMessage + "<p>"
            }).then(function () {
                // pass on the options to the next promise
                return options;
            });
        },

        /**
         * Redirect browser to database logged in with credentials
         * @param options {object} - with server and credentials
         */
        redirect = function (options) {
            // use rison to encode token and add to url
            var token = rison.encode_object({"token": options.credentials});
            window.location = "https://" + options.server + "/" + options.credentials.database + "#" + token;
        };

    if (CONFIG.debug) {
        elCompanyName.value = "qqq";
        elDatabaseName.value = "qqq";
        elPhoneNumber.value = "qqq";
        elFleetSize.value = "qqq";

        elFirstName.value = "qqq";
        elLastName.value = "qqq";
        elEmail.value = "qqq@qqq.com";
        elPassword.value = "qqq";
        elConfirmPassword.value = "qqq";
    }

    // Wire up events
    /**
     * Watch the company name, generate the short database name from it and check it's availability
     */
    elCompanyName.addEventListener("keyup", function () {
        var splitCompanyName = elCompanyName.value.split(/\s+/);
        var databaseName = splitCompanyName.length ? splitCompanyName[0] : "";
        elDatabaseName.value = databaseName;
        updateShortDatabase(databaseName);
    }, false);

    /**
     * Watch the database name and check it's availability
     */
    elDatabaseName.addEventListener("keyup", function () {
        updateShortDatabase(elDatabaseName.value);
    });

    /**
     * Watch the password and check it's validity
     */
    elPassword.addEventListener("keyup", function () {
        if (elConfirmPassword.value) {
            validatePassword();
        }
    });

    /**
     * Watch the password conformation and check it's validity
     */
    elConfirmPassword.addEventListener("keyup", function () {
        if (elConfirmPassword.value) {
            validatePassword();
        }
    });

    elImportFile.addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];

        if (file && file.name && (!importedConfigFile || (importedConfigFile.name !== file.name && importedConfigFile.lastModified !== file.lastModified))) {
            importedConfigFile = file;
        }
    });

    /**
     * Watch required fields and remove field error when no longer empty
     */
    for (var i = 0; i < elRequiredInputs.length; i++) {
        elRequiredInputs[i].addEventListener("keyup", function (evt) {
            if (evt.target.value) {
                changeValidationState(evt.target.parentNode, validationState.none);
            }
        });
    }

    /**
     * Hide error message on click
     */
    elErrorClose.addEventListener("click", hideError);

    /**
     * Handel form submit
     */
    elSubmit.addEventListener("click", function (evt) {
        var formValues;

        var error = function (error) {
            hideLoading();

            renderCaptcha();
            elSubmit.removeAttribute("disabled");

            showError(error);
            if (error.name === "CaptchaException") {
                elCaptchaAnswer.focus();
            }
        };

        evt.preventDefault();

        elSubmit.setAttribute("disabled", "disabled");

        hideError();
        formValues = getFormValues();

        if (!isFormValid(formValues)) {
            elSubmit.removeAttribute("disabled");
            return;
        }

        showLoading();

        createDatabase(formValues)
            .then(authenticate)
            .then(getUser)
            .then(createClearance)
            .then(setUserDefaults)
            .then(uploadConfigFile)
            .then(importConfig)
            .then(sendSuccessEmail)
            .then(redirect, error);
    });

    // Setup the form fields that need to request data from the API
    renderCaptcha();
    renderTimeZones();
});
