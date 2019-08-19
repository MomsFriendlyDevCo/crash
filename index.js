var _ = require('lodash');
var colors = require('chalk');
var fspath = require('path');

var crash = {
	defaults: {
		// Options used by crash.trace()
		logger: console.log,
		prefix: 'ERROR',
		colors: {
			message: colors.reset,
			prefix: colors.bgRed.bold,
			tree: colors.red,
			function: colors.yellowBright,
			seperator: colors.grey,
			native: colors.grey,
			path: colors.cyan,
			linePrefix: colors.grey,
			line: colors.cyan,
			column: colors.cyan,
		},
		text: {
			prefixSeperator: ':',
			tree: '├',
			treeFirst: '├',
			treeLast: '└',
			seperator: ' @ ',
		},

		// Options used by crash.decode()
		parseSplitterNative: /^\s*at (?<callee>.+?) \(<anonymous>\)$/,
		parseSplitterFile: /^\s*at (?<callee>.+?) \((?<path>.+?):(?<line>[0-9]+):(?<column>[0-9]+)\)$/,
		ignorePaths: [
			/^internal\/modules\/cjs/,
		],
		filterUnknown: true,
	},


	/**
	* Output an error with a nice colored stack trace
	* This printer ignores any of the RegEx's in app.log.error.ignorePaths
	* @param {Error} error The error to display
	* @param {Object} [options] Additional cutomization options
	* @param {function} [options.logger=console.log] Output device to use
	* @param {string} [options.prefix] Optional prefix to display
	* @param {Object <function>} [options.colors] Color functions to apply to various parts of the output trace
	*/
	trace: (error, options) => {
		var settings = {
			...crash.defaults,
			...options,
		};

		var err = crash.decode(error, settings);

		settings.logger.apply(crash, [
			settings.prefix && settings.colors.prefix(settings.prefix + settings.text.prefixSeperator),
			settings.colors.message(err.message),
		].filter(i => i));

		if (err.trace) err.trace.forEach((trace, traceIndex) => settings.logger(
			' ' + settings.colors.tree(
				traceIndex == 0 ? settings.text.treeFirst
				: traceIndex == err.trace.length - 1 ? settings.text.treeLast
				: settings.text.tree
			)
			+ ' ' + settings.colors.function(trace.callee)
			+ settings.colors.seperator(settings.text.seperator)
			+ (
				trace.isNative
				? settings.colors.native('native')
				: `${settings.colors.path(trace.path)} ${settings.colors.linePrefix('+')}${settings.colors.line(trace.line)}:${settings.colors.column(trace.column)}`
			)
		));
	},


	/**
	* Decode a string stack trace into its component parts
	* @param {Error} error The error object to decode
	* @param {Object} [options] Additional decoding options
	* @param {RegExp} [options.parseSplitterNative] How to decode native function lines
	* @param {RegExp} [options.parseSplitterFile] How to decode named function lines
	* @param {Array <RegExp>} [options.ignorePaths] RegExp matches for paths that should be ignored when tracing
	* @param {boolean} [options.filterUnknown=true] Filter garbage strack trace lines
	* @returns {Object} An object composed of `{message,trace}` where trace is a collection containing `{type, callee, path?, line? column?}`
	*/
	decode: (error, options) => {
		var settings = {
			...crash.defaults,
			...options,
		};

		return {
			message: error && error.message ? error.message
				: error && error.toString() ? error.toString()
				: error ? error
				: 'Unknown error',
			trace: error && error.stack
				? error.stack
					.split(/\n/)
					.slice(1) // Skip first line which is just the error text
					.map(line => {
						var extracted = settings.parseSplitterNative.exec(line);
						if (extracted) return {...extracted.groups, type: 'native'};

						var extracted = settings.parseSplitterFile.exec(line);
						if (extracted) return {...extracted.groups, type: 'path'};

						return {callee: line, type: 'unknown'};
					})
					.filter(trace =>
						trace.type == 'native'
						|| (!settings.filterUnknown && trace.type != 'unknown')
						|| (trace.type == 'path' && !settings.ignorePaths.every(re => re.test(trace.path)))
					)
				: undefined,
		};
	},


	/**
	* Print a stack trace then immediately terminate the process, halting all execution
	* @param {Error} error The error object to print
	* @param {Object} [options] Additional customization options
	* @see crash.trace() for full options definitions
	*/
	stop: (error, options) => {
		crash.trace(error);
		process.exit(1);
	},
};
module.exports = crash;
