var _ = require('lodash')
var md5 = require('md5')
var moment = require('moment')
var async = require('async')
var uuid = require('node-uuid')
var base = require('./base')
var db = require('./db')
var logger = require('../logger')
var Users = {}


/**
 * Register a new user by email and password
 * @param  {[type]}   email      [description]
 * @param  {[type]}   passwd   [description]
 * @param  {[type]}   screenName [description]
 * @param  {Function} callback   [description]
 * @return {[type]}              [description]
 */
Users.create = function(email, passwd, callback) {
  Users.getByEmail(email, function(err, user) {
    if (err) {
      return callback(err)
    }
    if (user) {
      return callback('email exists', user)
    }
    var hashed = md5(passwd)
    var query = "INSERT INTO user (email, passwd) VALUES (?, ?)"
    db.insertQuery(query, [email, hashed], function(err, id) {
      if (err) {
        return callback(err)
      }
      Users.get(id, callback) // get new user
    })
  })
}

/**
 * Get users by ids
 * @param  {[type]}   ids      [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.getUsers = function(ids, callback) {
  var queryStr = "SELECT id, email from user WHERE id IN (?)"
  db.getObjectsByIds(queryStr, ids, callback)
}

/**
 * Get a user by id
 * @param  {[type]}   id       [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.get = function(id, callback) {
  base.getObject(id, Users.getUsers, callback)
}


/**
 * Get user by email
 * @param  {[type]}   email    [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.getByEmail = function(email, callback) {
  var sql = 'SELECT id FROM user WHERE email = ?'
  db.getId(sql, [email], function(err, id) {
    if (err) {
      return callback(err)
    }
    Users.get(id, callback)
  })
}


/**
 * Validate email and password
 * @param  {[type]}   email    [description]
 * @param  {[type]}   password [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.validate = function(email, password, callback) {
  Users.getByEmail(email, function(err, user) {
    if (err) {
      return callback(err)
    }
    if (!user) {
      return callback('user not exists')
    }
    var queryStr = 'SELECT passwd FROM user WHERE id = ?',
      params = [user.id]
    db.getId(queryStr, params, function(err, hashed) {
      if (err) {
        return callback(err)
      }
      if (md5(password) == hashed) {
        return callback(null, user)
      } else {
        callback('Invalid password')
      }
    })
  })
}


/**
 * Generate a token for hours
 * @param  {[type]} userId [description]
 * @param  {[type]} hours  [description]
 * @param  {[type]} type   [description]
 * @return {[type]}        [description]
 */
Users.generateToken = function(userId, hours, type) {
  return {
    userId: userId,
    token: uuid.v4(),
    type: type,
    expires: moment().add(hours, 'h').toDate(),
    maxAge: hours * 60 * 60 * 1000
  }
}

/**
 * Save token data
 * @param  {[type]}   token    [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.saveToken = function(tokenData, callback) {
  var queryStr = "REPLACE INTO user_tokens (user_id, token, created, expires, type) VALUES (?, ?, ?, ?, ?)"
  db.executeQuery(queryStr, [tokenData.userId, tokenData.token, moment().unix(), moment(tokenData.expires).unix(), tokenData.type], callback)
}

/**
 * generate a new token for user, and save it to db
 * @param  {[type]}   userId   [description]
 * @param  {[type]}   hours    [description]
 * @param  {[type]}   type     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.generateAndSaveToken = function(userId, hours, type, callback) {
  var tokenData = Users.generateToken(userId, hours, type)
  var saveToken = function() {
      Users.saveToken(tokenData, function(err, results) {
        if (err) {
          return callback(err)
        }
        callback(null, tokenData)
      })
    }
  if (type === 'resetpass') { // delete all previous reset password token
    Users.removeUserTokens(userId, type, function(err, results) {
      if (err) {
        return callback(err)
      }
      saveToken()
    })
  }
  else {
    saveToken()
  }
}

/**
 * Find user by token
 * @param  {[type]}   token    [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.findByToken = function(token, type, callback) {
  var queryStr = "SELECT user_id FROM user_tokens WHERE token = ? AND type = ? AND expires > ?"
  db.getId(queryStr, [token, type, moment().unix()], function(err, id) {
    if (err) {
      callback(err)
    }
    else {
      Users.get(id, callback)
    }
  })
}


/**
 * Remove a token by token string
 * @param  {[type]}   token    [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.removeToken = function(token, callback) {
  var queryStr = "DELETE FROM user_tokens WHERE token = ?"
  db.executeQuery(queryStr, token, callback)
}


/**
 * Delete user's tokens
 * If the type is null, delete all user's tokens
 * @param  {[type]}   userId   [description]
 * @param  {[type]}   type     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.removeUserTokens = function(userId, type, callback) {
  var queryStr, params
  if (type) {
    queryStr = "DELETE FROM user_tokens WHERE user_id = ? AND type = ?"
    params = [userId, type]
  }
  else {
    queryStr = "DELETE FROM user_tokens WHERE user_id = ?"
    params = [userId]
  }
  db.executeQuery(queryStr, params, callback)
}


/**
 * Update user's password
 * @param  {[type]}   userId   [description]
 * @param  {[type]}   password [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Users.updatePassword = function(userId, password, callback) {
  Users.encryptPassword(password, function(err, hashed) {
    if (err) {
      return callback(err)
    }
    var queryStr = "UPDATE user SET password = ? WHERE id = ?"
    db.executeQuery(queryStr, [hashed, userId], callback)
  })
}






module.exports = Users