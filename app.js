require('dotenv').config()
const XeroClient = require('xero-node').AccountingAPIClient;
const config = require('./config.json');
const fs = require('fs');

var express = require("express"),
    session = require('express-session'),
    bodyParser = require("body-parser"),
    AWS = require('aws-sdk'),
    dynamo = require('./dynamo'),
    twilio = require('./twilio'),
    dailyJob = require('./scheduledJob'),
    crypto = require("crypto");
    
//jquery
// require("jsdom").env("", function(err, window) {
//     if (err) {
//         console.error(err);
//         return;
//     }
 
//     var $ = require("jquery")(window);
// });
    

// Set the region 
AWS.config.update({region: 'us-east-2'});

var app = express();
//from xero-node sample app
app.set('trust proxy', 1);
app.use(session({
    secret: 'bidi bidi bom bom',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(function(req, res, next) {
  res.locals = req.session;
  next();
});


//general setup
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

//Xero Webhooks
const xeroWebhookKey = 'YNGJ+to1N5VqQbpUo07eeAyDP/z5VfrIwSMWnKgXcHlCuezpXR4D6poB0gSfPgkix6Xpw57bC7FpDgjojWjYnQ==';
let xeroWebhookBodyParser = bodyParser.raw({ type: 'application/json' })
var xero = new XeroClient(config);




//ROUTES

// Home Page
app.get('/', function(req, res) {
    res.render('home');
});

app.get('/login', function(req, res) {
   res.render('login'); 
});

app.get('/logout', function(req, res) {
    //reset session
    req.session.destroy();
    res.redirect('/');
});

app.get('/getStarted', function(req, res) {
    
       //TODO
        //if redirected here from failed phone verify - render with note that verify failed
        //on page show message that verify failed and to try again
        
    res.render('getStarted');
    
});

app.get('/settings', function(req, res){
    var connectionStatus = connectedToXero(req);
    var orgName = req.session.orgName;
    
    // use to block access to settings to logged in only
    if (req.session.userLoggedIn) {
        if (req.session.token == undefined) {
            console.log("session token undefined, redirecting to refreshXeroAccessToken route...");
            res.redirect('/refreshXeroAccessToken');
        } else {
            res.render('settings', {connectionStatus: connectionStatus, orgName: orgName});
        }
    } else {
        //if you're not logged in you can't get to settings
        res.redirect('/');
    }
});

//
//XERO
//

//Xero OAuth flow
app.get('/connectXero', function(req, res){
    
    (async () => {

    // Create request token and get an authorisation URL
    const requestToken = await xero.oauth1Client.getRequestToken();
    console.log('Received Request Token:', requestToken);
    
    //save to session object
    req.session.oauthRequestToken = requestToken.oauth_token;
    req.session.oauthRequestSecret = requestToken.oauth_token_secret;
    
    console.log("Here is the session:\n", req.session);

    var authUrl = xero.oauth1Client.buildAuthoriseUrl(requestToken);
    console.log('Authorisation URL:', authUrl);

    // Send the user to the Authorisation URL to authorise the connection
    res.redirect(authUrl);

    })();
});

// Redirected from xero with oauth results
app.get('/accessXero', function(req, res) {
    
    //set verifier and request token
    const oauth_verifier = req.query.oauth_verifier;
    const savedRequestToken = {
        oauth_token: req.query.oauth_token,
        oauth_token_secret: req.session.oauthRequestSecret
    };
    console.log("savedRequestToken: \n", savedRequestToken);
    
    // Once the user has authorised your app, swap Request token for Access token
    (async () => {
    
        const accessToken = await xero.oauth1Client.swapRequestTokenforAccessToken(savedRequestToken, oauth_verifier);
        console.log('Received Access Token:\n', accessToken);
        
        //store access token in session
        req.session.token = accessToken;
        console.log(req.session);
        
        //make new Xero -> await get org name -> save to session
        var newXero = new XeroClient(config, req.session.token);
        
        //save org name to session for display on settings page
        const orgResult = await newXero.organisation.get();
        let orgName = orgResult.Organisations[0].Name;
        req.session.orgName = orgName;
        
        
        //check if user has setup xero before
        //we use org name existing in DB as a sentinel for if user has been setup before
        //if user has org name they're good else download details
        dynamo.getUser(req.session.userPhoneNumber).then(
          function(data) {
            if (data.Item.orgName == undefined) {
                console.log("org name undefined, downloading details...");
                downloadNewUserDetails(req, res);
            } else {
                //don't need to download user details from Xero if you already have
                console.log("org name NOT undefined, NOT downloading user Xero details...");
            }
          }
        ).catch(function(error) {
            console.log(error);
        });
        
        
    
        //store access token in database
        dynamo.updateUserXeroAccessToken(req.session.userPhoneNumber, accessToken).then(
          function(data) {
            console.log("Succesfully saved accessToken to dynamo, redirecting to settings");
            res.redirect('/settings');
          }
        ).catch(function(error) {
            console.log(error);
            res.redirect('/');
        });

    })();
    
});

//user disconnect xero
app.get('/disconnectXero', function(req, res){
   //delete token from session
   req.session.token = "empty";
   
   //delete token from DB
    dynamo.updateUserXeroAccessToken(req.session.userPhoneNumber, req.session.token).then(
      function(data) {
        console.log("Succesfully updated item: ", data.Item);
        res.redirect('/settings');
      }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
});

//refresh access token to use API
app.get('/refreshXeroAccessToken', function(req, res) {
    //load access token into session for use by xero client
    dynamo.getUser(req.session.userPhoneNumber).then(
      function(data) {
        console.log("got user from DB: ", data.Item);
        
        if (data.Item.xeroAccessToken == "empty" || data.Item.xeroAccessToken == undefined) {
            //user has deleted Xero token from Bill Alert app side or never authed before //redirect to settings
            console.log("user has deleted Xero token from Bill Alert app side or never authed before\nredirecting to settings");
            req.session.token = 'empty';
            res.redirect('/settings');
        } else {
            //set the DB AccessToken on the Xero client
            const xero2 = new XeroClient(config, data.Item.xeroAccessToken);
           
            (async () => {
                //assume access token is expired
                //exchange it for a new one
                const newAccessToken = await xero2.oauth1Client.refreshAccessToken();
                console.log("Got new access token: ", newAccessToken);
                
                //save new access token in Session
                req.session.token = newAccessToken;
                
                //save new access token in DB
                dynamo.updateUserXeroAccessToken(req.session.userPhoneNumber, newAccessToken).then(
                  function(data) {
                    console.log("Succesfully refreshed user XeroAccessToken");
                  }
                ).catch(function(error) {
                    console.log(error);
                });
                
                //test using it with xero
                const xero3 = new XeroClient(config, newAccessToken);
                
                //save org name to session
                const orgResult = await xero3.organisation.get();
                req.session.orgName = orgResult.Organisations[0].Name;
                
                res.redirect('/settings');
            })();
          }
        }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
});

//xero webhooks
app.post('/webhook', xeroWebhookBodyParser, function(req, res) {
    
    console.log("\n\nIn webhook post route!!\n\n");

    console.log("Req: Xero Signature:", req.headers['x-xero-signature'])
    // Generate Signature
    var xeroWebhookSignature = crypto.createHmac("sha256", xeroWebhookKey).update(req.body.toString()).digest("base64");
    
    console.log("Res: Xero Signature:", xeroWebhookSignature)

    // ITR Check
    if (req.headers['x-xero-signature'] == xeroWebhookSignature) {
        
        console.log("\n\nIn ITR check !!\n\n");
        
        // ITR has succeeded, lets process the webhook
        // Parse body as a json object
        var jsonBody = JSON.parse(req.body.toString())

        jsonBody['events'].forEach(function(event) {
            if (event['eventCategory'] == "INVOICE") {
                
                console.log("\n\ngot webhook for invoice event!");
                console.log("event details: ", event);

                // TODO retrieve correct access token from DB
                // use event['tenantId']
                
                //make new xero to get invoices for that tenant and save to DB

                // xero.invoices.get({ InvoiceID: event['resourceId'] })
                //     .then(async function(invoice) {
                //         console.log(invoice.id)
                //         // TODO Enter invoice into DB
                //     }).catch(err => {
                //         // handle error
                //         console.log(err);
                //     });;

            }
        })

        res.statusCode = 200
    } else {
        // ITR Failed
        console.log("ITR Check Failed, webhook not processed")
        res.statusCode = 401
    }

    // a response with a session will be rejected by webhooks, so lets destroy the default session
    req.session.destroy();

    res.send()
})

//PHONE VERIFICATION

app.get('/enterVerificationCode', function(req, res) {
   res.render('enterVerificationCode'); 
});

app.post('/verifyPhoneNumber', function(req, res) {
    var theInputString = req.body.inputPhoneNumber;
    var countryCode = "1";  //default to US country code just in case
    
    if (req.body.countryCode !== undefined) {
        countryCode = req.body.countryCode;
    } else {
        console.log("req.body.countryCode undefined")
    }
    
    var userFound = false;
    
    //clean the input string
    var userInputPhoneNumber = returnNumbersOnly(theInputString);
    console.log("Cleaned string: "+userInputPhoneNumber);
    
    var totalPhoneNumber = "+"+countryCode+userInputPhoneNumber;
    console.log("Total phone number: ", totalPhoneNumber);
    
    (async () => {
    
        //if user is clicking through from login try to find them in database and if you can't redirect to getStarted
        if (req.body.isLoginAttempt) {
            console.log("caught isLoginAttempt!");
            let response = await dynamo.getUser(totalPhoneNumber).then(
              function(data) {
                if (data.Item == undefined) {
                    //if you can't find them error and redirect to getting started
                    console.log("Couldn't find user in database.\n");
                    return res.redirect('/getStarted');
                } else {
                    console.log("got user from DB: ", data.Item);
                    req.session.registeredUserIsAttemptingLogin = "true";
                    userFound = true;
                }
              }
            ).catch(function(error) {
                //if you can't find them error and redirect to getting started
                console.log("Caught error:\n", error);
                return res.redirect('/getStarted');
            });
        }
        
        // return out of route scope if someone tries to login but they can't be found in DB
        if (req.body.isLoginAttempt && !userFound) {
            return;
        }
       
        //generate a 4 digit verification code
        const generatedRandomCode = Math.floor(Math.random() * (9999 - 1000) + 1000);
        req.session.generatedRandomCode = generatedRandomCode;
        req.session.latestInputPhoneNumber = totalPhoneNumber;
        console.log("session generatedRandomCode is: "+req.session.generatedRandomCode);
    
        //send text with code
        twilio.sendText(totalPhoneNumber, "Your verification code is: "+req.session.generatedRandomCode);
        
        //redirect to code entry page //send code you generated -> so you can compare entry of code on following page
        res.redirect('/enterVerificationCode');
    
    })();
});

app.post('/checkVerificationCode', function(req, res){
    
    console.log("Before we compare codes, let's look at the session object:\n", req.session);
    
    //console.log("About to check this verification code: "+req.body.inputVerificationCode+" against session verification code: "+req.session.generatedRandomCode);
    
    //compare input verification code to grenerated one
    if (req.body.inputVerificationCode == req.session.generatedRandomCode) {

        if (req.session.registeredUserIsAttemptingLogin == "true") {
            //setup user logged-in session
            req.session.userLoggedIn = true;
            
            //store userPhoneNumber now that they're verified/logged in
            req.session.userPhoneNumber = req.session.latestInputPhoneNumber;
            
            console.log("Success logging in!");
            
            //TODO
            //redirect to new route to load DB details into user session then redirect to settings
            
            res.redirect("/settings");
        } else {
            //this is a new user registration
            //store userPhoneNumber now that it's verified
            req.session.userPhoneNumber = req.session.latestInputPhoneNumber;
            
            //store new user in DB
            dynamo.createUser(req.session.userPhoneNumber).then(
              function(data) {
                /* process the data */
                console.log("Created new user with phone number: ", data.item);
                
                //setup user logged-in session
                req.session.userLoggedIn = true;
                
                //redirect to settings to finish setup and xero etc
                res.redirect('/settings');
              }
            ).catch(function(error) {
                console.log("Error creating user: \n",error);
                res.redirect('/');
            });
        }
        
    } else {
        console.log("Code not verified. Please try again.");
        //redirect to getting started to try again
        res.redirect('/');
    }
});

app.get('/testFeature', function(req, res){
    
});


//
//MY HELPER FUNCTIONS
//

function downloadNewUserDetails(req, res) {
    //assume fresh access token - no need to check expiry
    
    if (connectedToXero(req)) {
        var newXero = new XeroClient(config, req.session.token);
        
        (async () => {
         
            const orgResult = await newXero.organisation.get();
            const   orgName = orgResult.Organisations[0].Name,
                    orgShortCode = orgResult.Organisations[0].ShortCode,
                    orgID = orgResult.Organisations[0].OrganisationID;
            req.session.orgName = orgName;
            
            //save org details to DB
            dynamo.updateUserOrgDetails(req.session.userPhoneNumber, orgName, orgShortCode, orgID);
            
            //download ACCPAY invoices only (Bills)
            var args = {where: `Type=="ACCPAY"`};
            const result = await newXero.invoices.get(args);
            console.log('\nNumber of bills:', result.Invoices.length);
            
            var scrubbedInvoices = [];
            
            for (var i=0; i<result.Invoices.length; i++){
                //make new map of invoice details
                var newInvoice = {};
                newInvoice.InvoiceID = result.Invoices[i].InvoiceID;
                newInvoice.AmountDue = result.Invoices[i].AmountDue;
                newInvoice.AmountPaid = result.Invoices[i].AmountPaid;
                newInvoice.DueDateString = result.Invoices[i].DueDateString;
                scrubbedInvoices.push(newInvoice);
            }
            
            //save them to DB
            dynamo.updateUserInvoices(req.session.userPhoneNumber, scrubbedInvoices);
        })();
    } else {
        console.log("Error: user not connected to Xero");
    }
}

function connectedToXero(req){
    if (req.session.token != "empty" && req.session.token != undefined) {
        return true;
    } else {
        return false;
    }
}

function returnNumbersOnly(theOriginalString) {
    return theOriginalString.replace(/\D/g,'');
}


///////
///////////////
///////

// SCHEDULED JOB
//this runs for every user in the database!

// dailyJob.start();

///////
///////////////
///////

//start server
app.listen(process.env.PORT, process.env.IP, function(){
    console.log("server started homie @ %s:%s", process.env.IP, process.env.PORT );
});