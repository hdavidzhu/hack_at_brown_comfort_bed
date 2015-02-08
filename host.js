// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

// When we `require('tessel')` here, this is the library out of `node_modules`
// for USB communication. It's not the same as the `tessel` module built into
// the Tessel firmware that code on the Tessel uses for hardware access --
// that's only available to JS that executes on the Tessel itself.
var tessel = require('tessel');
var script =  require.resolve('./device/index.js');
var fs = require('fs');

var opts = {
  // Stop existing script, if any
  stop: true,
  // Serial number (`undefined` picks the first one)
  serial: process.env.TESSEL_SERIAL,
};

var args = [];
var accelerometer_buffer = [];
var new_acc_buffer = [];
var light_buffer = [];
var new_light_buffer = [];
var sound_buffer = [];
var new_sound_buffer = [];

// `tessel.findTessel` finds a Tessel attached to this computer and connects.
tessel.findTessel(opts, function(err, device) {
  if (err) throw err;

  // Once we've found a Tessel, we tell it to run our script. This works just
  // like `tessel run` and bundles the `device/` directory. It bundles only
  // `device/` and not the host code because `device/` has its own
  // `package.json`.
  device.run(script, args, {}, function () {
    // Connect the stdout and stderr of the process running on Tessel to
    // the console, so that our `console.log` messages show.
    device.stdout.resume();
    device.stdout.pipe(process.stdout);
    device.stderr.resume();
    device.stderr.pipe(process.stderr);

    // `device.on('message', function (msg) { ... })` receives an event
    // when an object is received from Tessel.
    device.on('message', function (m) {
      accelerometer_buffer.push(m);
      if (accelerometer_buffer.length%50 === 0) {
        var new_acc_buffer = accelerometer_buffer;
        accelerometer_buffer = [];
        fs.appendFile("./test_file.json", JSON.stringify(new_acc_buffer, null, 2).slice(2,-2) + ",\n", function(err){
          if (err) throw err;
          console.log("Saved!");
        });
      }
    });

    // Exit cleanly on Ctrl+C.
    process.on('SIGINT', function() {
      // Try to stop the process on the Tessel
      device.stop();

      setTimeout(function () {
        // But if that fails, just exit
        logs.info('Script aborted');
        process.exit(131);
      }, 200);
    });

    // When the script on Tessel exits, shut down
    // USB communications and exit
    device.once('script-stop', function (code) {
      device.close(function () {
        process.exit(code);
      });
    });
  });
});