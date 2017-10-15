var fs = require("fs");
var path = require("path");

var glob = require("glob");
var fe = require("file-exists");
var gutil = require("gulp-util");
var through = require("through2");
var PluginError = gutil.PluginError;

var PLUGIN_NAME = "gulp-inject-content";

function injector(replacements, type) {
    return through.obj(function(file, enc, cb) {
        if (file.isNull()) {
            this.push(file);
            return cb();
        }

        if (file.isStream()) {
            // If you don't support streams
            cb(new gutil.PluginError(PLUGIN_NAME, "Streaming not supported yet."));
            return;
        }

        if (file.isBuffer()) {
            // get file contents
            var contents = file.contents.toString();

            // patterns to look for
            // $:pre{filename}  or $:pre{$varname}
            // $:post{filename} or $:post{$varname}
            var pattern = new RegExp(`\\$:${type}\\{\\$?[\\w\\d-_]+\\}`, "gi");
            // get current working directory
            var cwd = process.cwd();

            // get path where injection files are stored (./html/injection/)
            var __PATHS_HTML_REGEXP_SOURCE = path.join(cwd, "html/injection/");

            contents = contents.replace(pattern, function(match) {
                // clean the match (injection-name)
                var iname = match.replace(/\$\:(pre|post)\{|\}$/g, "");

                // check whether doing a file or variable injection
                if (iname.charAt(0) !== "$") { // file content-injection
                    // get the first glob match, this allows for all file type extensions.
                    var filename = glob.sync(__PATHS_HTML_REGEXP_SOURCE + iname + ".*")[0];
                    // if glob does not return a match then the file does not exist.
                    // therefore, just return undefined.
                    if (!filename) return undefined;
                    // check that file exists before opening/reading...
                    // return undefined when file does not exist...else return its contents
                    return (!fe.sync(filename)) ? undefined : fs.readFileSync(filename)
                        .toString()
                        .trim();
                } else { //variable content-injection
                    // lookup replacement from the provide replacements object
                    return replacements[iname.replace(/^\$/, "")] || undefined;
                }

                // return match as default...
                return match;
            });

            // replace file with new contents
            file.contents = Buffer.from(contents);
        }

        // Do stuff
        this.push(file);
        cb();
    });
}

injector.pre = function(replacements) {
    return injector(replacements || {}, "pre");
};
injector.post = function(replacements) {
    return injector(replacements || {}, "post");
};

module.exports = injector;
