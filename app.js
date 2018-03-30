const XeroClient = require('xero-node').AccountingAPIClient;
const config = require('./config.json');
const fs = require('fs');

var express = require("express");
var session = require('express-session');
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var AWS = require('aws-sdk');
var dynamo = require('./dynamo');

// Set the region 
AWS.config.update({region: 'us-east-2'});


var app = express();

//from xero-node sample app
app.set('trust proxy', 1);
app.use(session({
    secret: 'something crazy',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));


//general setup
mongoose.connect("mongodb://localhost/bill_alert");
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

let xero = new XeroClient(config);

//ROUTES

// Home Page
app.get('/', function(req, res) {
    res.render('home');
});

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
    
    //example
    // You can make API calls straight away
    const result = await xero.invoices.get();
    console.log('Number of invoices:', result.Invoices.length);
    
    //redirect to home page
    res.redirect('/settings');

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
    
    res.render('settings',
        {
            connectionStatus: connectionStatus
        }
    );
});


app.get('/testFeature', function(req, res){
    
    console.log("feature tested.");
});


//
//MY HELPER FUNCTIONS
//

function connectedToXero(req){
    if (req.session.token) {
        return true;
    } else {
        return false;
    }
}

//start server
app.listen(process.env.PORT, process.env.IP, function(){
    console.log("server started homie");
});