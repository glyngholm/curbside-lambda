const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

exports.twilioInterfaceHandler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json'
    };
    
    let authTwilioKey;
    
    try {
        authTwilioKey = JSON.parse(event.body).twilioKey;
        if (typeof authTwilioKey === 'undefined') {
            throw ("Unauthorized: Twilio Key incorrect");
        }
        
        
        var authparams = { "TableName": "StoreListing",
            "KeyConditionExpression": "storeID = :s1",
            "ExpressionAttributeValues": { ":s1": "Twilio" }
        };
        let qryResult = await dynamo.query( authparams ).promise();
        
        if (qryResult.Count == 0) {
            throw("Unauthorized: Twilio Key incorrect");
        }
        
        let authItems = qryResult.Items[0];
        
        if (authItems.key === authTwilioKey) {
            console.log("Authorized Twilio");
        }
        else {
            console.log(authTwilioKey);
            throw("Unauthorized: Twilio Key incorrect");
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
            case 'POST':
                var jsonBody = JSON.parse(event.body);
                
                var storeTimeParams = { "TableName": "StoreListing",
                    "KeyConditionExpression" : "storeID = :s1",
                    "ExpressionAttributeValues": { ":s1": jsonBody.storeID }
                };
                
                var qryStoreTime = await dynamo.query( storeTimeParams ).promise();
                
                if (qryStoreTime.Count > 0) {
                    if (typeof qryStoreTime.Items[0].lastCheckIn === 'undefined') {
                        throw new Error("Store has not checked in");
                    }
                    console.log(qryStoreTime.Items[0].lastCheckIn);
                    var timeSinceCheckin = diff_minutes(qryStoreTime.Items[0].lastCheckIn, new Date().toISOString());
                    console.log(timeSinceCheckin);
                    if (timeSinceCheckin > 5) {
                        throw new Error("Store has not checked in recently; ignoring - ".concat(timeSinceCheckin));
                    }
                }
                else {
                    throw new Error('Store not active');
                }
                
                if (typeof jsonBody.orderID != 'undefined' ) {
                
                    let putParams = { "TableName" : "PickupData" , 
                        "Item" : jsonBody };
                    
                    body = await dynamo.put( putParams ).promise();
                    body = jsonBody;
                }
                else {
                    body = "StoreCheckedIn ".concat(timeSinceCheckin);
                }
                break;
            case 'GET':
                var jsonBody = JSON.parse(event.body);
                
                var storeTimeParams = { "TableName": "StoreListing",
                    "KeyConditionExpression" : "storeID = :s1",
                    "ExpressionAttributeValues": { ":s1": jsonBody.storeID }
                };
                
                var qryStoreTime = await dynamo.query( storeTimeParams ).promise();
                
                if (qryStoreTime.Count > 0) {
                    if (typeof qryStoreTime.Items[0].lastCheckIn === 'undefined') {
                        throw new Error("Store has not checked in");
                    }
                    console.log(qryStoreTime.Items[0].lastCheckIn);
                    let timeSinceCheckin = diff_minutes(qryStoreTime.Items[0].lastCheckIn, new Date().toISOString());
                    console.log(timeSinceCheckin);
                    if (timeSinceCheckin > 5) {
                        throw new Error("Store has not checked in recently; ignoring - ".concat(timeSinceCheckin));
                    }
                }
                else {
                    throw new Error('Store not active');
                }
                break;
            default:
                throw new Error(`Unsupported method "${event.httpMethod}"`);
        }
    }
    
    
    catch (err) {
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

function diff_minutes(dt2, dt1) 
{
    var d1 = Date.parse(dt1);
    var d2 = Date.parse(dt2);
    var diff = (  d1 - d2 ) / 1000;
    diff /= 60;
    return Math.abs(Math.round(diff));
  
}