const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

exports.dashInterfaceHandler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
        "Access-Control-Allow-Headers" : "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*"
    };

    if (event.requestContext.http.method === "OPTIONS") {
        body = "OPTIONS";
        return {
            
            statusCode, body, headers
        }
    }
    
    let authStoreID;
    let authKey;
    
    try {
        authStoreID = event.headers["storeid"];
        authKey = event.headers["key"];
        if (typeof authStoreID === 'undefined' || typeof  authKey ===  'undefined' ) {
            throw ("Unauthorized: storeID and key are required");
        }
        
        
        var authparams = { "TableName": "StoreListing",
            "KeyConditionExpression": "storeID = :s1",
            "ExpressionAttributeValues": { ":s1": authStoreID }
        };
        console.log(authparams);
        let qryResult = await dynamo.query( authparams ).promise();
        console.log(qryResult);
        if (qryResult.Count == 0) {
            throw("Unauthorized: storeID/key not present");
        }
        
        let authItems = qryResult.Items[0];
        
        if (authItems.key === authKey) {
            console.log("Authorized - " + authStoreID);
        }
        else {
            throw("Unauthorized: storeID/key not valid");
        }
        
    }
        
        
    catch (err) {
        statusCode = 403;
        body = err;
        return {
            statusCode,
            body,
            headers
        };
    }
    
    
    
    

    try {
        switch (event.requestContext.http.method) {
            case 'GET':
                if (event.queryStringParameters.storeID != authStoreID) {
                    throw new Error("StoreID not Authorized");
                }
                var params = { "TableName": "PickupData",
                    "IndexName": "storeID-index",
                    "KeyConditionExpression": "storeID = :s1",
                    "ExpressionAttributeValues": { ":s1": event.queryStringParameters.storeID }
                };
                var response = await dynamo.query( params ).promise();
                body = response.Items;
                    
                break;
            case 'POST':
                body = await dynamo.put(JSON.parse(event.body)).promise();
                body = JSON.parse(event.body);
                break;
            case 'PUT':
                //console.log(event.body);
                var jsonBody = JSON.parse(event.body);
                if (jsonBody.storeID != authStoreID) {
                    throw new Error("StoreID not Authorized");
                }
                var params = {"TableName": "PickupData",
                    "Key": { "orderID": jsonBody.orderID, "storeID":jsonBody.storeID },
                    "UpdateExpression": "SET delivered = :d1",
                    "ExpressionAttributeValues": { ":d1": jsonBody.delivered },
                    "RETURN_VALUES" : "UPDATED_NEW"
                };

                body = await dynamo.update(params).promise()
                break;
            case 'OPTIONS':
                body = "";
                break;
            default:
                throw new Error(`Unsupported method "${event.httpMethod}"`);
        }
        var putParams = { "TableName": "StoreListing",
        "Key" : { "storeID": authStoreID },
        "UpdateExpression": "SET lastCheckIn = :t1",
        "ExpressionAttributeValues": { ":t1" : new Date().toISOString() }
        };
    
        var putReponse = await dynamo.update( putParams ).promise();
    
    } catch (err) {
        statusCode = '400';
        body = err.message;
    } finally {
        body = JSON.stringify(body);
    }
    
    
    return {
        statusCode,
        body,
        headers
    };
};
