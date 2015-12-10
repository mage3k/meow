var express = require('express')
var path = require('path')
var morgan = require('morgan')
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var session = require('express-session')
var hbs = require('express-hbs')
var validator = require('express-validator')
var passport = require('passport')
var multer = require('multer')
var middleware = require('./middleware')
var helpers = require('./helpers')
var config = require('./config')
var logger = require('./logger')
var routes = require('./routes')

var app = express()

var secret = config.session && config.session.secret ? config.session.secret : '1234567890QWERTY'
app.set('session.secret', secret)



middleware.passport(passport)


// view engine setup
app.engine('hbs', hbs.express3({
  partialsDir: path.join(__dirname, 'views/partials')
}))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'views'))
helpers.registerSiteHelpers(hbs)

app.use(morgan('dev'))
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())
app.use(cookieParser(config.cookie.secret))

app.use(validator())

app.use(session({
  secret: secret,
  key: 'app.sid',
  resave: false,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())
app.use(routes.autoLogin) // auto login from token
app.use(function(req, res, next) {
  // Make sure we have a locals value.
  res.locals = res.locals || {}
  res.locals.session = {
    user: req.user
  }
  next()
})


app.use(express.static(path.join(__dirname, '../static/assets')))
// Static assets
app.use('/shared', express.static(path.join(__dirname, '../shared')))
app.use('/vendors', express.static(path.join(__dirname, '../bower_components')))
app.use('/js', express.static(path.join(__dirname, '/../built/scripts')))
app.use('/css', express.static(path.join(__dirname, '/../built/css')))

app.use('/', routes)

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

/// error handlers
// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    if (err.status != 404) {
      console.log('request error dev', err ? err.message : err, err ? err.stack : '')
    }
    res.status(err.status || 500)
    res.render('error', {
      message: err.message,
      error: err
    })
  })
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  console.log('request error dev', err ? err.message : err, err ? err.stack : '')
  res.status(err.status || 500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})

module.exports = app