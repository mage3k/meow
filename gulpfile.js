var watchify = require('watchify')
var path = require('path')
var gulp = require('gulp')
var gutil = require('gulp-util')
var sourcemaps = require('gulp-sourcemaps')
var cssmin = require('gulp-cssmin')
var less = require('gulp-less')
var gls = require('gulp-live-server')


gulp.task('server', function() {
  var options = {
    cwd: undefined
  };
  options.env = process.env;
  options.env.NODE_ENV = 'development';

  var server = gls('server/bin/www', options, 35729);
  server.start();

  gulp.watch(['config*.js', 'server/bin/*', 'server/**/*.js*'], function() {
    server.start();
  });
  gulp.watch(['static/assets/**/*.css', 'static/assets/**/*.js', 'server/views/**/*.hbs'], function() {
    server.notify.apply(server, arguments);
  });
});


gulp.task('styles', function() {
  return gulp.src('static/less/screen.less').pipe(sourcemaps.init()).pipe(less()).pipe(sourcemaps.write()).pipe(gulp.dest('static/assets/css')).pipe(cssmin());
});

gulp.task('dev', ['styles', 'server'], function() {
  gulp.watch('static/less/**/*.less', ['styles']);
});

gulp.task('default', ['dev'], function() {});