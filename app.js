require('dotenv').config()
const XeroClient = require('xero-node').AccountingAPIClient;
const config = require('./config.json');
const fs = require('fs');


var express = require("express"),
    session = require('express-session'),
    // passport = require('passport'),
    // LocalStrategy = require('passport-local'),
    bodyParser = require("body-parser"),
    // mongoose = require("mongoose"),
    AWS = require('aws-sdk'),
    dynamo = require('./dynamo'),
    twilio = require('./twilio');
    


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
// mongoose.connect("mongodb://localhost/bill_alert");
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

let xero = new XeroClient(config);



//ROUTES

// Home Page
app.get('/', function(req, res) {
    res.render('home');
});

//XERO

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
        console.log('Received Access Token:', accessToken);
        
        // You should now store the access token securely for the user.
        req.session.token = accessToken;
        console.log(req.session);
    
        //store access token in database
        //try adding org name to user in dynamo
        console.log("primary key value: ", req.session.userPhoneNumber);
        dynamo.updateUserXeroAccessToken(req.session.userPhoneNumber, accessToken).then(
          function(data) {
            console.log("Succesfully updated item: ", data.Item);
            res.redirect('/settings');
          }
        ).catch(function(error) {
            console.log(error);
            res.redirect('/');
        });

    })();
    
});

app.get('/disconnectXero', function(req, res){
   if (req.session.token) {
       //delete token
       req.session.token = "";
   } else {
       console.log("no token to delete...");
   }
   res.redirect('/settings');
});

app.get('/settings', function(req, res){
    var connectionStatus = connectedToXero(req);
    
// use to block access to settings to logged in only
    if (req.session.userLoggedIn) {
        res.render('settings',
            {
                connectionStatus: connectionStatus
            }
        );
    } else {
        //if you're not logged in you can't get to settings
        res.redirect('/');
    }
    
});

app.get('/getStarted', function(req, res) {
    
       //TODO
        //if redirected here from failed phone verify - render with note that verify failed
        //on page show message that verify failed and to try again
        
    res.render('getStarted');
    
});

//PHONE VERIFICATION

app.get('/enterVerificationCode', function(req, res) {
   res.render('enterVerificationCode'); 
});


app.post('/verifyPhoneNumber', function(req, res) {
    var theInputString = req.body.inputPhoneNumber;
    var userFound = false;
    
    //clean the input string
    var userInputPhoneNumber = returnNumbersOnly(theInputString);
    console.log("Cleaned string: "+userInputPhoneNumber);
    if (userInputPhoneNumber.length !== 10) {
        console.log("Phone Number length wrong!");
        return res.redirect('/');
    }
    
    (async () => {
    
        //if user is clicking through from login try to find them in database and if you can't redirect to getStarted
        if (req.body.isLoginAttempt) {
            let response = await dynamo.getUser(userInputPhoneNumber).then(
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
            console.log("about to try to return");
            return;
        }
       
        //generate a verification code
        var generatedRandomCode = Math.floor(Math.random() * 10000);
        req.session.generatedRandomCode = generatedRandomCode;
        req.session.latestInputPhoneNumber = userInputPhoneNumber;
        console.log("session generatedRandomCode is: "+req.session.generatedRandomCode);
    
        //send text with code
        twilio.sendText(userInputPhoneNumber, "Your verification code is: "+req.session.generatedRandomCode);
        
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
            res.redirect("/settings");
        } else {
        
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


app.get('/login', function(req, res) {
   res.render('login'); 
});

app.get('/logout', function(req, res) {
    //reset session
    req.session.destroy();
    res.redirect('/');
});



app.get('/testFeature', function(req, res){
    
    //YOU'RE TRYING TO USE ACCESS TOKEN RETRIEVED FROM DB
        
        //TODO in production
        //if loggedIN
        
        //check if session has access token 
        // if (connectedToXero(req)) {
        //   //check if access token expired
        //   //if so refresh and store in session+DB
        // } 
        //else 
        //check if DB has access token
        //if yes refresh
        //if no say error you must connect to xero first
    
    
    //load access token into session for use by xero client
    dynamo.getUser(req.session.userPhoneNumber).then(
      function(data) {
        console.log("got user from DB: ", data.Item);
        console.log("Xero AccessToken expires at: ", data.Item.xeroAccessToken.oauth_expires_at);
        
        
        //set the DB AccessToken on the Xero client???
        const xero2 = new XeroClient(config, data.Item.xeroAccessToken);
        
        //TODO
        //check if expired!! 
        //if yes -> Refresh
        
        
        //else try to use API
        
        
        //try to use xero
        (async () => {
            // IF EXPIRED -> refresh token and make new xero client with it
            // const newAccessToken = await xero2.oauth1Client.refreshAccessToken();
            // console.log("Got new access token: ", newAccessToken);
            // const xero3 = new XeroClient(config, newAccessToken);
            
            const result = await xero2.invoices.get();
            console.log('Number of invoices:', result.Invoices.length);
        })();
        
        res.redirect('/settings');
      }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
});


//
//MY HELPER FUNCTIONS
//


function updateUserOrgName (req, res,phoneNumber, orgName) {
    //try adding org name to user in dynamo
    dynamo.updateUserOrgName(phoneNumber, orgName).then(
      function(data) {
        console.log("Succesfully updated item: ", data.Item);
        
        res.redirect('/settings');
      }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
}

function getUser(req, res) {
    // handle promise's fulfilled/rejected states
    dynamo.getUser('1111111116').then(
      function(data) {
        console.log("User phone number: ", data.Item);
        //TODO
        //USE THIS BLOCK TO DO SOMETHING NEXT WITH USER
        res.redirect('/');
      }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
}

function connectedToXero(req){
    if (req.session.token) {
        return true;
    } else {
        return false;
    }
}

function returnNumbersOnly(theOriginalString) {
    return theOriginalString.replace(/\D/g,'');
}






//start server
app.listen(process.env.PORT, process.env.IP, function(){
    console.log("server started homie");
});