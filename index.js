var fs = require("fs");
var path = require("path");

var glob = require("glob");
var fe = require("file-exists");
var gutil = require("gulp-util");
var through = require("through2");
var PluginError = gutil.PluginError;

var PLUGIN_NAME = "gulp-inject-content";

/**
 * Inject file or variable content into a file.
 *
 * @param  {object} options - The options object.
 * @return {object} - The through object.
 */
function injector(options) {
	// default options
	var defaults = {
		// the location of the injectable files
		directory: "html/injection/",
		replacements: {}, // the variable replacements
		type: "pre", // pre|post
		// match filename exactly (take extension into consideration)
		exact: true,
		// cache file contents to speed up performance
		cache: true
	};

	// merge provided options with defaults
	options = Object.assign(defaults, options);

	// get options
	var directory = path.join(process.cwd(), options.directory);
	var type = -~["pre", "post"].indexOf(options.type)
		? ":" + options.type
		: "";
	var replacements = options.replacements;
	var exact = options.exact;
	var cache = options.cache;

	// these are the valid patterns to look for in a file:
	// $:pre{filename}  or $:pre{$varname}
	// $:post{filename} or $:post{$varname}
	// ${filename} or ${$varname} // any time replacement

	// the regexp pattern for the above patterns
	var pattern = new RegExp(`\\$${type}\\{\\$?[\\w\\d-_.]+\\}`, "gi");

	// cache opened file's contents to not re-open files
	var lookup = {};

	return through.obj(function(file, enc, cb) {
		if (file.isNull()) {
			this.push(file);
			return cb();
		}

		if (file.isStream()) {
			// if you don't support streams
			cb(
				new gutil.PluginError(
					PLUGIN_NAME,
					"Streaming not supported yet."
				)
			);
			return;
		}

		if (file.isBuffer()) {
			// get file contents
			var contents = file.contents.toString();

			contents = contents.replace(pattern, function(match) {
				// clean the match (injection-name) by removing any
				// injection syntax
				var iname = match.replace(/\$(:pre|:post)?\{|\}$/g, "");

				// check whether doing a file or variable injection

				// file content-injection
				if (iname.charAt(0) !== "$") {
					// when this flag is provided it will find the file with
					// the exact file name provided.
					var filename = path.join(directory, iname);

					// when exact is set to false the file extension does not
					// matter so the first file found matching the name
					// regardless of the file extension will be used.
					if (!exact) {
						// get the first glob match, this allows for all file
						// type extensions.
						filename = glob.sync(directory + iname + ".*")[0];

						// if glob does not return a match then the file does
						// not exist. therefore, just return undefined.
						if (!filename) return undefined;
					}

					// now that we have the file path...get file contents

					// check cache when flag is set (set to cache by default)
					if (cache) {
						var cached = lookup[iname];

						// if cached content exists return that
						if (cached) {
							return cached;
						}
					}

					// else get file contents if the file exists
					if (fe.sync(filename)) {
						// get file contents
						var fcontents = fs
							.readFileSync(filename)
							.toString()
							.trim();

						// cache when flag is set
						if (cache) {
							// cache the file contents
							lookup[iname] = fcontents;
						}

						// return contents
						return fcontents;
					}

					// default to undefined when no file is found
					return undefined;
				} else {
					//variable content-injection
					// lookup replacement from the provide replacements object
					return replacements[iname.replace(/^\$/, "")];
				}

				// return match as default...
				return match;
			});

			// replace file with new contents
			file.contents = Buffer.from(contents);
		}

		// do stuff
		this.push(file);
		cb();
	});
}

injector.pre = function(options) {
	// default to empty object if not provided
	options = options || {};
	// set the type
	options.type = "pre";

	return injector(options);
};
injector.post = function(options) {
	// default to empty object if not provided
	options = options || {};
	// set the type
	options.type = "post";

	return injector(options);
};

module.exports = injector;
